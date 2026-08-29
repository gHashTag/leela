#!/usr/bin/env node
/**
 * No test puts a ceiling on wall-clock time without saying why.
 *
 *     node scripts/audit-timing.mjs
 *
 * Written 2026-08-29, after the third flake of one shape. `kept.test.ts` failed
 * at 1283 ms against a bound of 1_000 when a dozen workspaces ran at once;
 * `waiting.test.ts` failed against 400 ms at a clean checkout the next morning;
 * and #64's was the same idea as a suite timeout. **Each was repaired by raising
 * the number** — the move #46–#49 already wrote down as wrong, because a
 * measurement taken to explain a load problem is subject to the load.
 *
 * A ceiling is falsified by a slow machine and says nothing about the code. A
 * FLOOR — *it waited at least N* — a slow machine only makes more true, so it
 * is not counted. `lib/timing.mjs` tells them apart.
 *
 * What replaces a ceiling is nearly always to hand: count the calls instead of
 * timing them, or drive the clock yourself with fake timers. `kept.test.ts` did
 * the second on the day this was written and its four new cases catch a
 * deadline firing at 0 ms and at ten times its argument — neither of which the
 * five-second ceiling they replaced could have seen.
 *
 * Static, over the test files, so it runs anywhere and needs nothing.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { finish } from './lib/report.mjs';
import { blank, sourceFilesUnder } from './lib/source.mjs';
import { DECLARED, wallClockBounds } from './lib/timing.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const testFiles = ['apps', 'packages']
  .flatMap((group) => sourceFilesUnder(join(ROOT, group)))
  .filter((file) => !file.includes('node_modules'))
  .filter((file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
  .sort();

/** Every ceiling on disk, by file. Floors are counted but never required. */
const ceilings = new Map();
let floors = 0;
let read = 0;

for (const file of testFiles) {
  const bounds = wallClockBounds(blank(readFileSync(file, 'utf8')));
  read += 1;
  floors += bounds.filter((one) => !one.upper).length;

  const upper = bounds.filter((one) => one.upper);
  if (upper.length > 0) ceilings.set(relative(ROOT, file), upper);
}

const declared = new Map(DECLARED.map((one) => [one.file, one]));

const undeclared = [...ceilings]
  .filter(([file]) => !declared.has(file))
  .map(([file, upper]) => `  ${file}: ${upper.length} ceiling(s), and no entry says why\n      ${upper[0].statement.slice(0, 90)}`);

const gone = [...declared.keys()]
  .filter((file) => !ceilings.has(file))
  .map((file) => `  ${file}: declared, and has no ceiling — the entry describes nothing`);

const miscounted = [...declared.values()]
  .filter((one) => ceilings.has(one.file) && ceilings.get(one.file).length !== one.bounds)
  .map((one) => `  ${one.file}: declared ${one.bounds}, found ${ceilings.get(one.file).length}`);

const unexplained = DECLARED.filter((one) => String(one.because ?? '').trim() === '').map(
  (one) => `  ${one.file}: declared with no reason given`,
);

const problems = [...undeclared, ...gone, ...miscounted, ...unexplained];

process.exitCode = finish({
  allClear:
    `Every ceiling on wall-clock time is declared with a reason, and every declaration still ` +
    `describes one.`,
  sections: [
    {
      failing: false,
      lines: [
        `\nRead ${read} test files for assertions that bound elapsed wall-clock time.`,
        `  ${[...ceilings.values()].flat().length} ceiling(s) in ${ceilings.size} file(s), all declared below.`,
        `  ${floors} floor(s), which are not counted: a slow machine only makes a floor more true.`,
        ...DECLARED.map((one) => `\n  ${one.file} — ${one.because}`),
      ],
    },
    {
      failing: true,
      heading: '\nA ceiling on wall-clock time that nothing accounts for:\n',
      lines: problems,
      epilogue:
        '\nA ceiling is falsified by a busy machine and says nothing about the code.\n' +
        'Before declaring one, try the two things that replace it: COUNT the calls\n' +
        'instead of timing them, or drive the clock with `vi.useFakeTimers()`. Both\n' +
        'answer the same question exactly, on a loaded machine and an idle one alike.\n' +
        'If neither fits, add an entry to DECLARED in scripts/lib/timing.mjs saying\n' +
        'what the margin is and what it was measured against.',
    },
  ],
});
