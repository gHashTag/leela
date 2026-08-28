/**
 * The improvement loop, as something that can be asked rather than assumed.
 *
 * Written 2026-08-28, because the loop that maintains this repository stopped
 * for a hundred and twelve hours and **nothing anywhere said so**. Its lock was
 * taken at 2026-08-23 22:05 and never released; every surface it maintains —
 * the board, the bot, the store listing — stayed up and green the whole time,
 * so every probe in `status.mjs` read well while the thing that fixes them was
 * dead. The one surface the dashboard did not measure was the one measuring
 * everything else.
 *
 * Three separate single points of failure were found that morning, each of
 * which had been silent:
 *
 *   1. **The lock said only when.** Its whole contents were `1787497537` — an
 *      epoch and nothing else. A reader cannot tell an iteration that is
 *      working from one that died holding it, so the protocol fell back to
 *      "older than an hour means abandoned", which is a guess in both
 *      directions: it trampled a long run and it waited an hour on a corpse.
 *   2. **The scheduler leaves almost no trace.** It runs inside a process; when
 *      that process goes, the schedule goes with it and the only mark left is a
 *      `lastFiredAt` in a JSON file — which is refreshed the moment anything
 *      fires again, so it reads *healthy two minutes ago* on a machine that has
 *      run nothing for five days. That is why the heartbeat below is the
 *      load-bearing row and the cron row is only context.
 *   3. **Nothing recorded a finished iteration at all.** Work reached `origin`
 *      three times with no journal entry, so the record of what the loop had
 *      done was three commits behind what it had actually done.
 *
 * Everything here is a pure function over text that something else read off the
 * disk, for the same reason the rest of `lib/` is: the probes cannot be tested
 * without the world, and these are exactly the parts that were wrong.
 */

/**
 * How long a lock may go WITHOUT A SIGN OF LIFE before it is abandoned.
 *
 * An hour, the figure the contract has always used — but it used to be
 * measured from the moment the lock was TAKEN, and this is the correction.
 *
 * **The sentence that stood here was measured false.** It read *"an iteration
 * takes minutes; an hour is generous"*. Iterations #50 and #51 ran an hour and
 * a half each, doing nothing unusual — a competitor probe, three full suites,
 * five falsifications — and the dashboard reported each of their live locks as
 * ABANDONED while they were writing the very journal entry that noticed it.
 * That is not a cosmetic misreport: an abandoned lock is an invitation, and the
 * next cron to fire would have been cleared to start work on top of a running
 * iteration. Twice in two days, which is a rule being wrong rather than a run
 * being unusual.
 *
 * So age is no longer measured from the taking. The holder marks the lock as it
 * passes each step of the contract, and this bounds the SILENCE between marks.
 * An hour without a word is a corpse: the gates alone speak every few minutes.
 *
 * A lock that was never marked still reads from its taking time, so an
 * iteration that forgets to mark behaves exactly as every iteration did before
 * this existed. The change cannot make anything worse than it already was.
 */
export const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * How long one iteration may hold the lock even while it keeps speaking.
 *
 * Six hours. Silence catches a session that died; this catches one that is
 * alive and going nowhere — a loop that keeps marking the lock while making no
 * progress, which is a shape this project has already produced once elsewhere.
 *
 * Far above any real iteration (the longest measured is an hour and a half)
 * and far below the 112-hour outage that started all of this. Without it the
 * marking would be a way to hold the lock for ever, which would be the
 * original bug with a motor attached.
 */
export const HELD_AT_MOST_MS = 6 * 60 * 60 * 1000;

/**
 * How long the loop may be silent before silence is a finding.
 *
 * A day. The schedule fires every fifteen minutes, so twenty-four hours is not
 * a machine that was asleep over lunch — it is a loop that has stopped. The
 * threshold is generous on purpose: a dashboard that goes red because a laptop
 * was shut overnight is a dashboard nobody reads.
 */
export const SILENT_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * The exit code that means "somebody else is working" — and why it is not 1.
 *
 * The lock protocol replaced a 112-hour silent outage, and three days later it
 * had reintroduced one in a worse form. The contract read:
 *
 *     node scripts/loop-lock.mjs take    # exit 1 means EXIT SILENTLY
 *
 * and **node exits 1 when it cannot find the module you asked it to run.**
 * Measured 2026-08-28: `node scripts/does-not-exist.mjs` exits 1, the same code
 * as a refusal. So if this worktree were ever deleted — and the previous one
 * was, it lived in /tmp and the disk took it — every scheduled run would read
 * "held" and exit without a word, for ever. Nothing would ever get far enough
 * to look at the lock, so the staleness rule that eventually rescued the first
 * outage could not rescue this one. A fix that makes its own absence look like
 * success is worse than the bug it fixed.
 *
 * 75 is `EX_TEMPFAIL` from sysexits — "try again later", which is exactly what
 * a held lock means. What matters is only that node cannot produce it by
 * accident: an uncaught throw, a missing module and a bad flag are 1, 1 and 9.
 * **Exit 1 from this script now means the protocol is broken, and the run must
 * say so rather than assume it is somebody else's turn.**
 */
export const HELD = 75;

/**
 * What `take` should do about a lock in this state.
 *
 * Pure, so the exit-code contract above is a thing a test can hold rather than
 * a sentence in a document. The document was the problem.
 */
export function takeVerdict(state) {
  if (state.state === 'held') {
    return { code: HELD, taken: false, say: `refused: ${state.why}` };
  }

  return {
    code: 0,
    taken: true,
    // Said out loud rather than done quietly: stepping over somebody else's
    // lock is the one act here that can lose another agent's work, and an
    // operator reading a log should see which rule cleared it.
    say: state.state === 'abandoned' ? `clearing an abandoned lock — ${state.why}` : '',
  };
}

/**
 * Who holds the lock, out of whatever the lock file happens to contain.
 *
 * Two shapes are parsed and the older one is not going away: the lock found on
 * 2026-08-28 held a bare epoch, written by every iteration up to that day, and
 * a reader that threw on it would have failed on the exact file this whole
 * measurement exists for. `unreadable` is a third answer rather than an error —
 * a lock whose text nobody can parse is still a lock somebody wrote, and
 * calling it "free" would let a second iteration in on top of a first.
 */
export function holderFrom(text) {
  const said = String(text ?? '').trim();
  if (said === '') return null;

  try {
    const parsed = JSON.parse(said);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const at = Number(parsed.at);
      const beat = Number(parsed.beat);
      return {
        at: Number.isFinite(at) ? milliseconds(at) : null,
        // The last time the holder said it was still there. Absent on every
        // lock written before 2026-08-29 and on any iteration that never
        // marks one, and absent is not zero: `lastSignFrom` falls back to the
        // taking time, which is exactly the old behaviour.
        beat: Number.isFinite(beat) ? milliseconds(beat) : null,
        marks: Number.isInteger(parsed.marks) ? parsed.marks : 0,
        pid: Number.isInteger(parsed.pid) ? parsed.pid : null,
        host: typeof parsed.host === 'string' && parsed.host !== '' ? parsed.host : null,
        shape: 'named',
      };
    }
  } catch {
    // Not JSON. The bare form below is the shape that was actually on disk.
  }

  if (/^\d+$/.test(said)) {
    return { at: milliseconds(Number(said)), beat: null, marks: 0, pid: null, host: null, shape: 'bare' };
  }

  return { at: null, beat: null, marks: 0, pid: null, host: null, shape: 'unreadable' };
}

/**
 * A timestamp in milliseconds, whichever unit it was written in.
 *
 * **The bare lock is in seconds.** It was written by `date +%s`, and the first
 * draft of this file compared it against `Date.now()` — so every legacy lock
 * read as roughly half a million hours old, and the first run of `loop-lock.mjs
 * state` against the real file printed exactly that. It is the direction that
 * costs something: a bare lock taken a minute ago also reads as ancient, so a
 * second iteration would have cleared it and started work on top of a living
 * one. That is the single outcome this whole file exists to prevent, and it was
 * introduced by the file preventing it.
 *
 * Told apart by magnitude, which is unambiguous rather than a guess: 1e11 as
 * milliseconds is 1973 and as seconds is the year 5138, so no timestamp any
 * lock here could hold is near the boundary.
 */
function milliseconds(at) {
  return at < 1e11 ? at * 1000 : at;
}

/**
 * Whether that holder is still working, or has been there too long.
 *
 * **Age, and only age — and the pid rule that used to be here was worse than
 * useless. Retracted 2026-08-28, six hours after it was written.**
 *
 * Iteration 32 added: *a dead process releases the lock immediately, however
 * young it is*, to spare every scheduled run an hour of waiting on a corpse.
 * The reasoning was right and the premise was false. The process that takes
 * this lock is `loop-lock.mjs`, which **exits the instant it returns** — the
 * work is done afterwards by a session it cannot see. So the pid in the file
 * is dead within milliseconds of being written, and the rule read every live
 * iteration as abandoned.
 *
 * That is not a missed optimisation. It is the mutual exclusion gone: a second
 * cron firing partway through an iteration would have found a dead pid, called
 * the lock abandoned, and started work on top of a running one — the exact
 * outcome the whole file exists to prevent, and the second time this loop has
 * introduced it while fixing something else.
 *
 * Caught by the dashboard reporting `ABANDONED` for a lock that was being held
 * at that moment, which is what a surface that measures its own author is for.
 *
 * **A pid can only be trusted by a reader who knows the writer outlives the
 * write.** Nothing here does: the taker is a command, not a daemon, and it has
 * no way to name the session that will do the work. So the pid is kept in the
 * file, where a person debugging can see who wrote it, and it decides nothing.
 * An hour is the bound, as it always was; the 112-hour outage was never caused
 * by that hour being too long, but by nothing applying it at all.
 */
export function lastSignFrom(holder) {
  if (holder === null) return null;
  // The mark if there is one, otherwise the taking. NOT `Math.max`: a lock
  // marked once and then left is described by that mark, and taking the larger
  // of the two would be the same thing only by accident of ordering.
  return holder.beat ?? holder.at;
}

/**
 * The lock file a holder writes to say it is still there.
 *
 * Here rather than in `loop-lock.mjs` because of ONE property, and it is the
 * property that decides whether any of this is safe: **`at` is carried, never
 * restamped.** Restamping it would reset the age the six-hour cap measures,
 * and marking would become an unbounded hold — the 112-hour outage with a
 * motor attached, arrived at while fixing the opposite problem. A rule that
 * dangerous does not belong in a script no test can reach.
 *
 * `at` falls back to now only when the lock on disk never said when it was
 * taken. That lock is already `abandoned` by `lockState`, and a mark should not
 * be able to launder it into a fresh one — but it is better to date it than to
 * write a second undated lock, and the state it produces is honest either way.
 */
export function markedFrom(holder, { now, step = '', pid = null, host = null }) {
  return {
    at: holder.at ?? now,
    iso: new Date(now).toISOString(),
    beat: now,
    marks: (holder.marks ?? 0) + 1,
    pid,
    host,
    step,
  };
}

export function lockState(
  holder,
  { now, staleAfterMs = STALE_AFTER_MS, heldAtMostMs = HELD_AT_MOST_MS },
) {
  if (holder === null) return { state: 'free', ageMs: null, silentMs: null, why: 'there is no lock file' };

  const ageMs = holder.at === null ? null : now - holder.at;
  const sign = lastSignFrom(holder);
  const silentMs = sign === null ? null : now - sign;

  if (silentMs === null) {
    return { state: 'abandoned', ageMs, silentMs, why: 'it does not say when it was taken' };
  }

  if (silentMs > staleAfterMs) {
    return {
      state: 'abandoned',
      ageMs,
      silentMs,
      // Which clock ran out is named, because the two are different diagnoses:
      // silence is a session that died, and the cap below is one that did not.
      why:
        holder.beat === null
          ? `it has been held for ${hours(silentMs)} without ever saying it is still there`
          : `nothing has been heard from it for ${hours(silentMs)}`,
    };
  }

  if (ageMs !== null && ageMs > heldAtMostMs) {
    return {
      state: 'abandoned',
      ageMs,
      silentMs,
      why: `it is still speaking but has held the lock ${hours(ageMs)}, past the six an iteration may have`,
    };
  }

  return {
    state: 'held',
    ageMs,
    silentMs,
    why:
      holder.beat === null
        ? `taken ${hours(ageMs)} ago`
        : `taken ${hours(ageMs)} ago, heard from ${hours(silentMs)} ago${holder.marks > 0 ? ` (${holder.marks} marks)` : ''}`,
  };
}

/**
 * What the last iteration that finished left behind.
 *
 * Malformed reads as "no heartbeat" and never throws. That is the
 * constitution's fourth principle applied to this file's own record: a mark
 * written by a crashed process is exactly the case where half a JSON object is
 * likely, and a status tool that dies reading its own notes is worse than one
 * that says it has none.
 */
export function heartbeatFrom(text) {
  try {
    const parsed = JSON.parse(String(text ?? ''));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const at = Number(parsed.at);
    if (!Number.isFinite(at)) return null;

    return {
      at,
      iteration: parsed.iteration === undefined || parsed.iteration === null ? null : String(parsed.iteration),
      commit: typeof parsed.commit === 'string' && parsed.commit !== '' ? parsed.commit : null,
      note: typeof parsed.note === 'string' ? parsed.note : '',
    };
  } catch {
    return null;
  }
}

/**
 * The schedule that is supposed to be starting these iterations, if any.
 *
 * Read out of the scheduler's own store and matched on the text of the prompt,
 * because the task carries no name and its id is a hash that changes whenever
 * the owner recreates it. What this row is worth is bounded and stated at the
 * top of the file: `lastFiredAt` is refreshed by the run that reads it, so it
 * can say "two minutes ago" on a machine that did nothing for five days.
 */
export function cronFrom(text, mentions) {
  try {
    const parsed = JSON.parse(String(text ?? ''));
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    const found = tasks.find((task) => typeof task?.prompt === 'string' && task.prompt.includes(mentions));
    if (found === undefined) return null;

    const firedAt = Number(found.lastFiredAt);
    return {
      cron: typeof found.cron === 'string' ? found.cron : '?',
      lastFiredAt: Number.isFinite(firedAt) ? firedAt : null,
    };
  } catch {
    return null;
  }
}

/** Whole hours, for a report a person reads at a glance. */
function hours(ms) {
  const whole = Math.floor(ms / 3_600_000);
  if (whole >= 1) return `${whole} h`;
  return `${Math.max(0, Math.floor(ms / 60_000))} min`;
}

/** A timestamp in the shape the rest of the report uses. */
function when(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * The loop's rows, in the order they answer the question "is it running?".
 *
 * The heartbeat first, because it is the only one of the three that a stopped
 * loop cannot fake: the lock can be free because nothing has ever taken it, and
 * the cron can look freshly fired because reading it is firing it.
 */
export function loopFindings({ holder, heartbeat, cron, now, silentAfterMs = SILENT_AFTER_MS }) {
  const rows = [];

  if (heartbeat === null) {
    rows.push({
      surface: 'loop',
      name: 'the last iteration',
      value: 'NONE RECORDED',
      note: 'no finished iteration has left a mark here',
      kind: 'wrong',
    });
  } else {
    const age = now - heartbeat.at;
    const silent = age > silentAfterMs;
    rows.push({
      surface: 'loop',
      name: 'the last iteration',
      value: `${heartbeat.iteration === null ? 'finished' : `#${heartbeat.iteration}`} at ${when(heartbeat.at)}`,
      note: silent ? `${hours(age)} ago — SILENT` : `${hours(age)} ago${heartbeat.commit === null ? '' : `, ${heartbeat.commit}`}`,
      kind: silent ? 'wrong' : 'fine',
    });
  }

  const lock = lockState(holder, { now });
  rows.push({
    surface: 'loop',
    name: 'the lock',
    value: lock.state === 'abandoned' ? 'ABANDONED' : lock.state,
    note: lock.why,
    // An abandoned lock is not history: until something clears it, the reading
    // of the old protocol was to exit, so it stops every run that comes after.
    kind: lock.state === 'abandoned' ? 'wrong' : 'fine',
  });

  if (cron === null) {
    rows.push({
      surface: 'loop',
      name: 'the schedule',
      value: 'NOT SCHEDULED',
      note: 'no task in the scheduler names the contract',
      kind: 'wrong',
    });
  } else {
    const age = cron.lastFiredAt === null ? null : now - cron.lastFiredAt;
    rows.push({
      surface: 'loop',
      name: 'the schedule',
      value: cron.cron,
      note: age === null ? 'has never fired' : `last fired ${hours(age)} ago`,
      kind: age === null || age > silentAfterMs ? 'wrong' : 'fine',
    });
  }

  return rows;
}
