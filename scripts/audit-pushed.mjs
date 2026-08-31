#!/usr/bin/env node
/**
 * Did the daily push go out today, and only when it should have?
 *
 *     node scripts/audit-pushed.mjs [--day YYYY-MM-DD]
 *
 * Needs: `~/.leela/daily-quote.log`, which is on the machine that sends and
 *        nowhere else. **Deliberately not in CI.**
 *
 * Written 2026-08-31, after a day that cost a push and nobody noticed.
 * `audit-quotes` reads what the sender WOULD send; nothing read whether it
 * sent. The log had five consecutive `06:00 SENT` lines and then, for that
 * morning, nothing at all — a laptop asleep at six is a push that never
 * happened, recorded only in a file no one opens.
 *
 * **It also catches a send that was not the schedule**, and that is not a
 * refinement. The same log carries `16:58:35 SENT`, hours off the hour,
 * because I ran the sender by hand while working on the quote file — every
 * subscriber's phone lit up for a message no shipped feature asked for. A guard
 * that counted sends would have called that day a success. The hour is part of
 * the claim.
 *
 * Two `if`s rather than an `if`/`else`: a top-level `} else {` sends
 * `a-closing-sentence-nothing-governs.test.ts` into an infinite loop (#68).
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { dayOf, entriesIn, exitCodeFor } from './lib/pushed.mjs';
import { finish } from './lib/report.mjs';

const LOG = join(process.env.LEELA_HOME ?? join(homedir(), '.leela'), 'daily-quote.log');

const flag = process.argv.indexOf('--day');
const local = new Date(Date.now() + 7 * 3600 * 1000); // the sender's own +07
const DAY = flag > -1 ? process.argv[flag + 1] : local.toISOString().slice(0, 10);

if (!existsSync(LOG)) {
  // The absence of the log is not the absence of a push, and must not read as
  // one. This machine may simply not be the one that sends.
  console.error(`No push log at ${LOG}. This is not the sending machine, or it has never sent.`);
  console.error('Nothing was checked — this is not a pass.');
  process.exitCode = 2;
}

if (existsSync(LOG)) {
  const entries = entriesIn(readFileSync(LOG, 'utf8'));
  const verdict = dayOf(entries, DAY);

  // Every day the log covers, so one missed morning three weeks ago is not
  // hidden by a green today.
  const covered = [...new Set(entries.map((one) => one.forDay))].sort();
  const missed = covered
    .map((day) => ({ day, ...dayOf(entries, day) }))
    .filter((one) => one.state !== 'sent' && one.day !== DAY);

  const alarm = {
    missed: { heading: `\nThe push did not go out:\n` },
    unscheduled: { heading: `\nA push went out that the schedule did not ask for:\n` },
    unknown: { heading: '\nNOTHING WAS ESTABLISHED — this is not a pass:\n' },
  }[verdict.state];

  const code = finish({
    allClear: `${verdict.why}, at the hour the schedule asks for.`,
    sections: [
      {
        failing: false,
        lines: [
          `\nRead ${entries.length} line(s) of ${LOG.replace(homedir(), '~')}, covering ${covered.length} day(s)`,
          `from ${covered[0] ?? '(none)'} to ${covered[covered.length - 1] ?? '(none)'}.`,
          ...missed.map((one) => `  earlier: ${one.why}`),
        ],
      },
      {
        failing: true,
        heading: alarm?.heading,
        lines: alarm ? [`  ${verdict.why}`] : [],
        epilogue:
          '\nThe sender is launchd — `ai.t27.leela.dailyquote`, 06:00 +07 — and it\n' +
          'cannot fire on a sleeping machine. `RunAtLoad` catches up only on a\n' +
          'reboot or a reload, so a laptop closed overnight loses the day silently.\n' +
          'A send off the hour is somebody’s hand: every subscriber was pushed to,\n' +
          'and the boundary says no messages to real users beyond what shipped\n' +
          'features already send.',
      },
    ],
  });

  if ((code === 0) !== (verdict.state === 'sent')) {
    throw new Error(`the report printed ${code === 0 ? 'an all-clear' : 'an alarm'} for a "${verdict.state}" verdict`);
  }

  process.exitCode = exitCodeFor(verdict.state);
}
