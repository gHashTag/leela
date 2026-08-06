#!/usr/bin/env node
/**
 * Check the numbers this repository says about itself.
 *
 * `README.md` carries a table of per-package test counts and a total, and both
 * have been maintained by hand for forty passes. The two passes before this one
 * were each about a confident sentence that had never been checked — a bot that
 * "dies without a volume" and did not, a contract "permanently deployed" to a
 * network that was shut down in 2024. A hand-kept number is the same kind of
 * sentence, waiting.
 *
 * Runs every package's suite and compares. Slower than the other audits and
 * worth it: this is the number a reader trusts most.
 *
 *   node scripts/audit-claims.mjs           # read only: says what disagrees, exits 1
 *   node scripts/audit-claims.mjs --write   # writes what it measured into README
 *
 * `--write` exists because of what the default was asking for. The script runs
 * all ten suites, learns the true counts, and then — holding those numbers —
 * failed and asked a person to retype six of them into a table. That is a check
 * whose commonest failure is *nobody retyped what the check computed*, which
 * means the build is red on days when nothing is wrong with the code. This
 * repository's own doctrine is that a check which cries wolf is one people
 * delete rather than obey, and a red that is usually not about the code is the
 * same thing wearing a different hat.
 *
 * So the default stays exactly as it was — read-only, loud, exit 1, which is
 * what CI wants — and the repair is one command instead of six retyped numbers.
 * What `--write` will not do is invent a table row for a package it has never
 * heard of, or delete one for a package that stopped running: those stay red,
 * because they are writing rather than arithmetic. See `lib/claims.mjs`.
 *
 * Three exit codes, because there are three things to say. 0: the numbers
 * agree and every suite passed. 1: the check has an answer and something
 * disagrees — a stale row, or a failing suite whose count was still read. 2:
 * at least one suite produced no readable report, so there is no measurement
 * to compare against and no edit to README will settle it. Until this pass
 * there was a fourth outcome, unnumbered and by far the commonest: a stack
 * trace, thrown away with the counts. See `lib/suites.mjs`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCounts, checkTotal, claimedCounts, claimedTotal, rewriteClaims } from './lib/claims.mjs';
import { UnreadableSuiteReport, capturedOutput, countsFrom } from './lib/suites.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Every workspace that ships code and runs tests. */
function packages() {
  const found = [];
  for (const group of ['packages', 'apps']) {
    const dir = join(ROOT, group);
    if (!existsSync(dir)) continue;

    for (const name of readdirSync(dir)) {
      const at = join(dir, name);
      if (!existsSync(join(at, 'package.json'))) continue;
      if (!existsSync(join(at, 'tests'))) continue;

      const manifest = JSON.parse(readFileSync(join(at, 'package.json'), 'utf8'));
      found.push({ name: manifest.name, at });
    }
  }
  return found;
}

/**
 * How many tests a package actually runs, red run or green.
 *
 * This used to be a bare `execFileSync` whose result went straight into
 * `JSON.parse`, and that is exactly one assumption too many: `execFileSync`
 * throws on a non-zero exit, and vitest exits non-zero the moment one assertion
 * is red. On 2026-08-06 the audit printed nine measured counts, reached
 * `@leela/mobile`, and produced a hundred kilobytes of stack — while the answer
 * it wanted, `"numTotalTests":396,"numFailedTests":1`, sat unread on the thrown
 * error. The check whose whole subject is whether README's numbers are true
 * told the reader nothing about README, and the table went unenforced for as
 * long as any suite anywhere was failing. It had drifted 311 tests by then.
 *
 * Capturing and reading are kept apart below. The exception is a fact about the
 * *exit code*, not about the report, and the report parses the same either way;
 * see `lib/suites.mjs`. Only a capture with no readable report in it is a real
 * failure here, and that is a different sentence with a different exit code:
 * "the suite is red, and here are its counts" is a measurement, "the suite
 * could not be run" is the absence of one.
 */
function run(at) {
  let output;
  try {
    output = execFileSync('npx', ['vitest', 'run', '--reporter=json'], {
      cwd: at,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // A non-zero exit is the ordinary shape of a red suite. The numbers came
    // back with it.
    output = capturedOutput(error);
  }

  return countsFrom(output);
}

const write = process.argv.slice(2).includes('--write');

const where = join(ROOT, 'README.md');
const readme = readFileSync(where, 'utf8');
const claimed = claimedCounts(readme);

const actual = new Map();
const red = new Map();
const unreadable = new Map();

for (const { name, at } of packages()) {
  process.stdout.write(`  ${name} … `);
  try {
    const counts = run(at);
    actual.set(name, counts.total);
    if (counts.red) red.set(name, counts);
    console.log(counts.red ? `${counts.total} (${counts.failed} failing)` : `${counts.total}`);
  } catch (error) {
    if (!(error instanceof UnreadableSuiteReport)) throw error;

    // Left out of `actual` on purpose. A package whose suite would not run is
    // not a package with zero tests, and the difference matters most under
    // `--write`, where a zero would be typed into README as a fact.
    unreadable.set(name, error);
    console.log(`could not be read (${error.kind})`);
  }
}

console.log(`\nChecked ${actual.size} packages against the table in README.md.\n`);

if (red.size > 0) {
  // Said before the comparison, and separately from it. A red suite is not
  // this check's subject — but its counts are measured from a run that stopped
  // short of nothing, so they are reported, and a reader is told which numbers
  // came out of a failing run rather than being left to wonder.
  console.log('Measured from a suite that is failing. The counts stand; the tests do not:\n');
  for (const [name, counts] of red) {
    console.log(`  ${name}: ${counts.failed} of ${counts.total} failing`);
  }
  console.log('');
}

if (unreadable.size > 0) {
  console.log('No measurement at all for these — nothing to compare README against:\n');
  for (const [name, error] of unreadable) console.log(`  ${name}: ${error.message}`);
  console.log('');
}

if (write) {
  if (red.size > 0) {
    // Said, not enforced. A red assertion still counts its test, so the number
    // is right in the ordinary case; a file that fails to collect is the case
    // where it is short, and only a person looking at the failure can tell
    // which of the two this is.
    console.log('Writing counts measured from at least one failing suite. If a file failed to collect, its count is short.\n');
  }

  const rewritten = rewriteClaims(readme, actual);

  // Reported by reading the result back, rather than by remembering what the
  // writer meant to do. A writer that says it changed a number it did not write
  // is worse than one that says nothing.
  const after = claimedCounts(rewritten);
  const changed = [...claimed]
    .filter(([name, count]) => after.get(name) !== count)
    .map(([name, count]) => `  ${name}: ${count} -> ${after.get(name)}`);

  const wasTotal = claimedTotal(readme);
  const nowTotal = claimedTotal(rewritten);
  if (wasTotal !== nowTotal) changed.push(`  the total: ${wasTotal} -> ${nowTotal}`);

  if (rewritten === readme) {
    console.log('Nothing to write: the README already states what the suites run.');
  } else {
    writeFileSync(where, rewritten);
    console.log('Wrote what the suites ran into README.md:\n');
    for (const line of changed) console.log(line);
    console.log('');
  }
}

const current = write ? readFileSync(where, 'utf8') : readme;
const stated = claimedCounts(current);

// A package whose suite could not be read is held out of the comparison rather
// than compared against nothing. `checkCounts` would otherwise say it "is in
// the table and ran nothing", which is a different and untrue sentence: it ran,
// and this script failed to read it. That failure is already reported above,
// in its own words, and it sets its own exit code below.
const comparable = new Map([...stated].filter(([name]) => !unreadable.has(name)));

const problems = [
  ...checkCounts(comparable, actual),
  // The total covers every row, including a row this run could not measure, so
  // it is checked against the table as written.
  ...checkTotal(stated, claimedTotal(current)),
];

if (problems.length === 0 && actual.size === 0) {
  // Found by breaking this on purpose: with every suite unreadable, `actual` is
  // empty, `checkCounts` has nothing to disagree with, and the table still adds
  // up to the total it states — so the check congratulated README on numbers it
  // had not measured. A check that says "all clear" after failing to look is
  // the exact failure this repository keeps finding elsewhere, arriving here.
  console.log('Nothing was measured, so nothing about README was checked.');
} else if (problems.length === 0 && unreadable.size > 0) {
  // The same care one step down: some rows were checked and some were not, and
  // saying "every number" would quietly claim the unmeasured ones too.
  console.log(`Every number that could be measured is the number README states. ${unreadable.size} could not be.`);
} else if (problems.length === 0) {
  console.log('Every number the README states is the number the suites run.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log(
    write
      ? '\nWhat is left is not arithmetic: a row added or removed says what a package is for.'
      : '\nA number kept by hand is a number that will eventually be wrong. Fix it with --write.',
  );
}

// Three outcomes, three exit codes, because they ask for three different
// things from whoever is reading. 1 says the check has an answer and the answer
// is that something disagrees — retype the table, or fix the failing suite. 2
// says the check has no answer for at least one package, which no amount of
// editing README will settle. The distinction is the point of this pass: the
// old code reported both of them, and the ordinary case of a single red
// assertion, as the same thing — a stack trace.
if (unreadable.size > 0) {
  console.log(
    `\n${unreadable.size} suite(s) produced no readable report. That is not a stale number; it is a missing measurement.`,
  );
  process.exitCode = 2;
} else if (problems.length > 0 || red.size > 0) {
  if (problems.length === 0) {
    console.log('\nThe numbers agree. The suites do not all pass.');
  }
  process.exitCode = 1;
}
