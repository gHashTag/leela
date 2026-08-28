#!/usr/bin/env node
/**
 * The improvement loop's lock and its heartbeat, as a command rather than a
 * paragraph.
 *
 *     node scripts/loop-lock.mjs state
 *     node scripts/loop-lock.mjs take
 *     node scripts/loop-lock.mjs mark --step "gates"
 *     node scripts/loop-lock.mjs release --iteration 32 --commit abc1234 --note "..."
 *
 * Written 2026-08-28. The protocol this replaces was three sentences in a
 * document telling an agent to write an epoch into a file and remember to
 * delete it, and on 2026-08-23 an iteration ran out of context holding it. The
 * lock then sat there for a hundred and twelve hours: it named no process, so
 * nothing could tell a working iteration from a dead one, and every run that
 * came after read "a lock exists" and stopped.
 *
 * Two properties this has and a paragraph cannot:
 *
 *   - **`take` refuses a lock that has spoken within the hour and clears one
 *     that has not.** The rule is `lockState`, which carries the retraction of
 *     the pid check that briefly stood here — THIS PROCESS EXITS BEFORE THE
 *     ITERATION BEGINS, so the pid it writes is dead within milliseconds and a
 *     reader trusting it called every live lock abandoned — and, since
 *     2026-08-29, the correction to the hour itself. It used to be measured
 *     from the TAKING, under a comment saying an iteration takes minutes.
 *     Iterations #50 and #51 each ran an hour and a half doing nothing unusual,
 *     and the dashboard called both of their live locks ABANDONED, which is an
 *     invitation for the next cron to work on top of a running one. `mark` is
 *     how a holder says it is still there; the hour now bounds SILENCE, and
 *     `HELD_AT_MOST_MS` bounds the whole hold so that marking cannot become a
 *     way to keep the lock for ever.
 *   - **`release` writes the heartbeat.** Recording that an iteration finished
 *     is not a step somebody can forget, because it is the same act as letting
 *     the next one start. Three iterations reached `origin` with no entry in
 *     the journal before this existed; the dashboard now reads that mark and
 *     goes red when it is a day old.
 *
 * **Exit codes, and the one that matters is not 1.** `take` exits 0 when the
 * lock is yours and **75** when somebody living has it. It is 75 because node
 * exits 1 for a module it cannot find, so a `1` here would mean this file's own
 * deletion read as "somebody else is working" — and the caller's instruction on
 * that code is to exit without a word. The worktree this lives in has vanished
 * once already. See `HELD` in `lib/loop.mjs`.
 *
 * So: 0 is yours, 75 is somebody's, and **anything else means the protocol is
 * broken and the run must say so**. `state` always exits 0 — it reports, it
 * does not judge.
 */

import { hostname } from 'node:os';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

import { holderFrom, lockState, markedFrom, takeVerdict } from './lib/loop.mjs';

const HOME = process.env.HOME ?? '';
const LOCK = process.env.LEELA_LOOP_LOCK ?? `${HOME}/.leela/LOOP.lock`;
const BEAT = process.env.LEELA_LOOP_HEARTBEAT ?? `${HOME}/.leela/heartbeat.json`;

/** Absent reads as empty, because a missing lock and an empty one are one state. */
const slurp = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
};

const holder = holderFrom(slurp(LOCK));
const state = lockState(holder, { now: Date.now() });
const command = process.argv[2] ?? 'state';

if (command === 'state') {
  console.log(`${state.state}: ${state.why}`);
  if (holder !== null) console.log(`  the lock is ${holder.shape}, at ${LOCK}`);

  const beat = slurp(BEAT);
  console.log(beat === '' ? '  no heartbeat has been written' : `  heartbeat: ${beat.trim()}`);
  process.exit(0);
}

if (command === 'take') {
  const verdict = takeVerdict(state);

  if (!verdict.taken) {
    console.error(verdict.say);
    // Not 1. See `HELD` in lib/loop.mjs: node exits 1 for a module it cannot
    // find, so 1 here would make this script's own absence read as a refusal.
    process.exit(verdict.code);
  }

  if (verdict.say !== '') console.log(verdict.say);

  writeFileSync(
    LOCK,
    // The pid is written for a person reading the file, and decides NOTHING:
    // this process exits before the iteration begins. See `lockState`.
    `${JSON.stringify({ at: Date.now(), iso: new Date().toISOString(), pid: process.pid, host: hostname() })}\n`,
  );
  console.log(`taken by pid ${process.pid} on ${hostname()}`);
  process.exit(0);
}

if (command === 'mark') {
  /*
   * "I am still here." Written by the holder as it passes each step of the
   * contract, and read by `lockState` in place of the taking time.
   *
   * WHY THIS EXISTS. The staleness rule used to measure from the moment the
   * lock was taken, under a comment saying an iteration takes minutes. It does
   * not: #50 and #51 each ran an hour and a half doing nothing unusual, and the
   * dashboard called both of their LIVE locks abandoned — which is an
   * invitation for the next cron to start work on top of a running iteration.
   *
   * WHY IT IS A COMMAND SOMEBODY CAN FORGET, which this file's own header
   * argues against. Two alternatives were considered and rejected:
   *
   *   - A DAEMON that marks on a timer. It needs no discipline, and an orphan
   *     of it holds the lock for ever — the 112-hour outage with a motor
   *     attached, and the one failure here that cannot be recovered by waiting.
   *   - A LONGER HOUR. It does not distinguish a live iteration from a dead
   *     one; it only chooses which of the two mistakes to make.
   *
   * Forgetting to mark leaves the lock judged from its taking time, which is
   * precisely how every lock was judged before this existed. So the worst case
   * of the new mechanism is the old mechanism, and `HELD_AT_MOST_MS` bounds the
   * best case so that marking cannot become a way to hold the lock for ever.
   *
   * It does NOT create a lock. A mark on a missing lock means the lock was
   * released or cleared underneath the holder, and inventing one there would be
   * a second iteration silently taking a lock nobody gave it.
   */
  if (holder === null) {
    console.error('there is no lock to mark — it was released or cleared while you were working');
    // Not 75: nobody is holding it. This is the protocol broken, which the
    // contract says must be reported rather than treated as somebody's turn.
    process.exit(2);
  }

  // `at` is CARRIED, never restamped — see `markedFrom`, where that rule lives
  // beside the test that breaks when it is broken.
  const marked = markedFrom(holder, {
    now: Date.now(),
    step: flag('step') ?? '',
    pid: process.pid,
    host: hostname(),
  });

  writeFileSync(LOCK, `${JSON.stringify(marked)}\n`);
  console.log(`marked (${marked.marks})${marked.step === '' ? '' : ` at ${marked.step}`}`);
  process.exit(0);
}

if (command === 'release') {
  writeFileSync(
    BEAT,
    `${JSON.stringify(
      {
        at: Date.now(),
        iso: new Date().toISOString(),
        iteration: flag('iteration'),
        commit: flag('commit'),
        note: flag('note') ?? '',
      },
      null,
      2,
    )}\n`,
  );

  // After the heartbeat, never before. A crash between the two would otherwise
  // free the lock while leaving the record saying the last iteration is older
  // than it is — which is the exact pair of facts this whole file is for.
  rmSync(LOCK, { force: true });
  console.log(`released; heartbeat written to ${BEAT}`);
  process.exit(0);
}

console.error(`unknown command "${command}" — expected state, take, mark or release`);
process.exit(2);
