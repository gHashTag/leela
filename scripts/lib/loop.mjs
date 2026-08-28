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
 * How long a lock may be held before it is treated as abandoned on age alone.
 *
 * An hour, which is the figure the loop's own contract has always used. It is a
 * fallback and not the primary test: when the holder names a live process on
 * this host, that process answers the question far better than a clock does.
 */
export const STALE_AFTER_MS = 60 * 60 * 1000;

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
      return {
        at: Number.isFinite(at) ? milliseconds(at) : null,
        pid: Number.isInteger(parsed.pid) ? parsed.pid : null,
        host: typeof parsed.host === 'string' && parsed.host !== '' ? parsed.host : null,
        shape: 'named',
      };
    }
  } catch {
    // Not JSON. The bare form below is the shape that was actually on disk.
  }

  if (/^\d+$/.test(said)) return { at: milliseconds(Number(said)), pid: null, host: null, shape: 'bare' };

  return { at: null, pid: null, host: null, shape: 'unreadable' };
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
 * Whether that holder is working, gone, or absent.
 *
 * The rule, and each half of it is there to fix a different failure:
 *
 *   - **A dead process releases the lock immediately, however young it is.**
 *     The lock this was written for was five days old under an hour-long
 *     timeout, which would have cleared it — but for the first hour after any
 *     crash the old rule made every scheduled run exit silently for nothing.
 *   - **A live process still loses it once it is stale.** Process ids are
 *     reused, and after a reboot the id an old lock names may belong to
 *     something else entirely; a run that has genuinely been going for hours
 *     has hung. Age settles both, and the pid can therefore only ever make
 *     recovery *faster*, never let a stale lock hold on longer.
 *   - **A pid from another host is not asked about.** `process.kill(pid, 0)`
 *     answers about this machine, and a lock written elsewhere would get a
 *     confident wrong answer instead of the honest fallback to age.
 *
 * `alive` is passed in rather than called here, because asking whether a
 * process exists is the world, and this file is the part that can be held
 * still.
 */
export function lockState(holder, { now, alive, here = null, staleAfterMs = STALE_AFTER_MS }) {
  if (holder === null) return { state: 'free', ageMs: null, why: 'there is no lock file' };

  const ageMs = holder.at === null ? null : now - holder.at;
  const stale = ageMs === null || ageMs > staleAfterMs;
  // Trusted only where same-host can be *established*. "We do not know our own
  // name" is not agreement, and the first draft of this line read it as one:
  // with `here` unknown it asked about a pid on `laptop.local` and condemned a
  // live lock. Its own doc comment above already said not to.
  const mine = holder.pid !== null && (holder.host === null || (here !== null && holder.host === here));

  if (mine && !alive(holder.pid)) {
    return { state: 'abandoned', ageMs, why: `the process that took it (pid ${holder.pid}) is gone` };
  }

  if (stale) {
    return {
      state: 'abandoned',
      ageMs,
      why:
        ageMs === null
          ? 'it does not say when it was taken'
          : `it has been held for ${hours(ageMs)}, past the hour an iteration may have`,
    };
  }

  return {
    state: 'held',
    ageMs,
    why: mine ? `pid ${holder.pid} is running` : `taken ${hours(ageMs)} ago`,
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
export function loopFindings({ holder, heartbeat, cron, now, alive, here = null, silentAfterMs = SILENT_AFTER_MS }) {
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

  const lock = lockState(holder, { now, alive, here });
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
