#!/usr/bin/env node
/**
 * The improvement loop's lock and its heartbeat, as a command rather than a
 * paragraph.
 *
 *     node scripts/loop-lock.mjs state
 *     node scripts/loop-lock.mjs take
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
 *   - **`take` refuses only to a holder it can show is alive.** A crashed
 *     iteration is stepped over at once, a live one is never trampled, and
 *     neither judgement is a guess about the clock — see `lib/loop.mjs` for the
 *     rule and the four cases it is tested against.
 *   - **`release` writes the heartbeat.** Recording that an iteration finished
 *     is not a step somebody can forget, because it is the same act as letting
 *     the next one start. Three iterations reached `origin` with no entry in
 *     the journal before this existed; the dashboard now reads that mark and
 *     goes red when it is a day old.
 *
 * Exit codes, because this is meant to be run from a script: `take` exits 0
 * when the lock is yours and 1 when somebody living has it. `state` always
 * exits 0 — it reports, it does not judge.
 */

import { hostname } from 'node:os';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

import { holderFrom, lockState } from './lib/loop.mjs';

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

/**
 * Whether a process id is running on this machine.
 *
 * Signal 0 checks for existence without delivering anything. `EPERM` means the
 * process is there and owned by somebody else, which is still there — reading
 * it as gone would hand the lock to a second iteration.
 */
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
};

const holder = holderFrom(slurp(LOCK));
const state = lockState(holder, { now: Date.now(), alive, here: hostname() });
const command = process.argv[2] ?? 'state';

if (command === 'state') {
  console.log(`${state.state}: ${state.why}`);
  if (holder !== null) console.log(`  the lock is ${holder.shape}, at ${LOCK}`);

  const beat = slurp(BEAT);
  console.log(beat === '' ? '  no heartbeat has been written' : `  heartbeat: ${beat.trim()}`);
  process.exit(0);
}

if (command === 'take') {
  if (state.state === 'held') {
    console.error(`refused: ${state.why}`);
    process.exit(1);
  }

  // Said out loud rather than done quietly: stepping over a lock somebody else
  // wrote is the one action here that can lose another agent's work, and an
  // operator reading a log should see which of the two rules cleared it.
  if (state.state === 'abandoned') console.log(`clearing an abandoned lock — ${state.why}`);

  writeFileSync(
    LOCK,
    `${JSON.stringify({ at: Date.now(), iso: new Date().toISOString(), pid: process.pid, host: hostname() })}\n`,
  );
  console.log(`taken by pid ${process.pid} on ${hostname()}`);
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

console.error(`unknown command "${command}" — expected state, take or release`);
process.exit(2);
