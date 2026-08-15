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

/*
 * RETRACTED, 2026-08-06, on the same day it was written. The paragraph that
 * stood here said `packages/content` runs 705 cases on a machine holding the
 * donor clones at `../leela-src` and 661 on a fresh clone, because
 * `content.test.ts` parameterises over that tree; that README therefore
 * publishes the stranger's numbers, content 661 and total 3499; and that
 * `--write` must never be run on a donor machine because it would write 705.
 *
 * Every clause of that was ASSUMED. None of it was measured. It is false, and
 * it is left here rather than deleted because the way it was wrong matters more
 * than the number it got wrong.
 *
 * What was MEASURED, and how. `git archive HEAD | tar -x -C /tmp/freshleela`
 * puts the committed tree — and nothing else — in a directory whose `..` is
 * `/tmp`, where no `leela-src` exists and never has. `node_modules` was
 * symlinked in, since dependencies are not what is in question. That tree runs
 * `Test Files 29 passed (29) / Tests 705 passed (705)`, under `bunx vitest run`
 * and under `npx vitest run` alike. This working tree, on a machine that does
 * hold the donor clones, runs the same 29 files and the same 705 cases. Same
 * data, same count, donors present or absent. The donor clones are not the cause.
 *
 * AND THE RETRACTION ITSELF CLOSED WRONG, which makes three wrong explanations
 * of one gap and is why this paragraph keeps growing rather than being deleted.
 * It used to close by calling 661 impossible — a figure it said nothing had ever
 * run. CI ran it twice in one go: GitHub Actions run 31072659705, commit
 * d0ad661, `Tests 661 passed (661)` in the `test` job's own vitest output, and
 * `@leela/content … 661` printed by this very script's step in the same log. Two
 * exact figures and a named cause again, about a number sitting in this
 * repository's own CI log. The measurement that was skipped both times cost one
 * command.
 *
 * The old sentence is paraphrased rather than quoted, and that is a deliberate
 * and slightly uncomfortable choice. This repository's habit is to keep the
 * exact wrong words, because the record of a defect is worth more than a tidy
 * file — but the words in question are a claim about a number, and a claim about
 * a number is the one kind of sentence somebody greps for. Left quoted, every
 * search for the false statement lands on the retraction of it, which is how a
 * check comes to cry wolf on the file that fixed the thing. What it said is
 * above, in full, in different words.
 *
 * The cause, MEASURED on 2026-08-06 and needing no Linux runner to see:
 * `packages/content/tests/undo.test.ts` generated one test case per byte of
 * `JSON.stringify({ path, original })`, and `path` was a file under
 * `mkdtempSync(join(tmpdir(), 'leela-undo-'))`. That note is 134 bytes when
 * `tmpdir()` is macOS's `/var/folders/cm/2n1qdh892xldd1rc2ly1jv8r0000gn/T` and
 * 90 bytes when it is Linux's `/tmp` — 44 cases of difference, which is the
 * entire published gap, and per-file JSON put all 44 of it in that one file: 171
 * cases here against CI's 127, every other file in the package agreeing with CI
 * to the case. Running the package twice on this machine under two `TMPDIR`s of
 * different lengths reproduced it directly, 739 against 754. That grid is built
 * from a literal path now and asserts its own width, so the number this script
 * measures here is the number it measures there.
 *
 * Why the `git archive` run above looked decisive and was not: it moved the
 * repository into `/tmp/freshleela` and left `tmpdir()` alone. The count never
 * depended on where the checkout sits. It depended on where the machine puts
 * temporary files, which extracting a tree into `/tmp` does not change.
 *
 * What was ASSUMED and is false, specifically. `LANGUAGES` does not come from
 * the filesystem: it is a literal array of 22 subtags in
 * `packages/content/src/language.ts`, and the four `it.each(LANGUAGES)` blocks
 * in `content.test.ts` are 22 cases each wherever they run. The dataset they
 * read, `packages/content/data`, is fully tracked — 26 files on disk, the same
 * 26 in `git ls-files`. The donor path does appear in `packages/content/tests`,
 * which is presumably what the guess was built on, but only in
 * `a-build-that-refuses.test.ts`, where `existsSync(DONOR)` chooses between two
 * *labels* for a row of a fixed two-row grid. It changes what a case is called.
 * It cannot change how many there are.
 *
 * Why this is the worst available mistake rather than an ordinary one: the
 * retracted paragraph read as a measurement. It carried two exact figures, a
 * named cause, and an operational warning, and it was written into the audit
 * whose entire purpose is to stop this repository from publishing numbers
 * nobody checked. A confident sentence about a count, never run — the same
 * shape as the bot that "dies without a volume" and did not, and the contract
 * "permanently deployed" to a dead network, both named at the top of this file.
 * The check was not defeated from outside; the exemption was written into it.
 *
 * What remains true, and it is the only part that survives: a count kept by
 * hand is a count that will be wrong. That is why this audit runs the suites.
 * Recover the table with `node scripts/audit-claims.mjs --write` on any machine
 * — there is no longer a machine on which that writes the wrong number, because
 * there was never more than one number. The guard against the *shape* of the
 * defect (a published count that could come to depend on something a stranger's
 * clone does not carry) lives in
 * `packages/content/tests/a-count-a-stranger-cannot-run.test.ts`.
 */
/*
 * And it had the defect it was written to describe. MEASURED on 2026-08-06, on
 * an ordinary working tree with one assertion red in `@leela/db`:
 *
 *     Measured from a suite that is failing. The counts stand; the tests do not:
 *
 *       @leela/db: 1 of 108 failing
 *
 *     Every number the README states is the number the suites run.
 *
 *     The numbers agree. The suites do not all pass.
 *
 * Three sentences, and the middle one is an unconditional all-clear standing
 * between the alarm and the correction of itself. The chain that printed it
 * asked only `problems.length === 0` — the arithmetic — while the decision to
 * fail was taken forty lines below over `red`, the suites that ran and did not
 * pass. The exit code was 1 and it was right. The sentence above it said the
 * README was verified, and a reader who reads the last lines of a run rather
 * than `$?` was told exactly that, on a run whose own next line contradicted it.
 *
 * That is the defect this repository has now found seven times, and this file is
 * the one that carries the paragraph about it at the top of every sibling: the
 * exit code is right and the sentence under it is wrong, and a human reads the
 * sentence. `scripts/lib/report.mjs` exists so it cannot be written again — its
 * guarantee 1 is that the all-clear is printed if and only if nothing failing
 * has anything to say — and this audit was the one that had not been converted.
 * Nothing here decides when to print any more: the three findings are handed
 * over as sections, the closing sentence is the module's `allClear`, and the
 * code is what the module returned. The two sentences that qualify a run rather
 * than clearing it stay conditional, because they are not all-clears; see them
 * below, where they are collected as a note that prints BESIDE a failure.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCounts, checkTotal, claimedCounts, claimedTotal, rewriteClaims } from './lib/claims.mjs';
import { finish } from './lib/report.mjs';
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
// and this script failed to read it. That failure is reported in its own words
// by the `unmeasured` section below, and it is what raises the exit code to 2.
const comparable = new Map([...stated].filter(([name]) => !unreadable.has(name)));

const problems = [
  ...checkCounts(comparable, actual),
  // The total covers every row, including a row this run could not measure, so
  // it is checked against the table as written.
  ...checkTotal(stated, claimedTotal(current)),
];

/**
 * The two sentences that qualify a run instead of clearing it.
 *
 * Collected as a note rather than handed over as the `allClear`, and the
 * difference is the whole reason they still exist. `finish` suppresses the
 * all-clear whenever anything failing has something to say — which is exactly
 * what these two are for saying it BESIDE. 'some rows could not be measured'
 * only ever prints on a run that already has an unreadable suite to report, so
 * an `allClear` spelling of it would be a sentence that is suppressed in every
 * case it was written for, which is a deletion wearing a repair's clothes.
 *
 * The first of them was found by breaking this on purpose: with every suite
 * unreadable, `actual` is empty, `checkCounts` has nothing to disagree with, and
 * the table still adds up to the total it states — so the check congratulated
 * README on numbers it had not measured. A check that says "all clear" after
 * failing to look is the exact failure this repository keeps finding elsewhere,
 * arriving here. The second is the same care one step down: some rows were
 * checked and some were not, and saying "every number" would quietly claim the
 * unmeasured ones too.
 *
 * Both stay conditional on `problems.length === 0`, because both are claims
 * about the arithmetic, and neither is true on a run that found a stale row.
 */
const qualified = { failing: false, lines: [] };
if (problems.length === 0 && actual.size === 0) {
  qualified.lines.push('Nothing was measured, so nothing about README was checked.');
} else if (problems.length === 0 && unreadable.size > 0) {
  qualified.lines.push(
    `Every number that could be measured is the number README states. ${unreadable.size} could not be.`,
  );
}

/**
 * A red suite is not this check's subject — but its counts are measured from a
 * run that stopped short of nothing, so they are reported, and a reader is told
 * which numbers came out of a failing run rather than being left to wonder.
 *
 * Failing, and that word is the repair. `red` used to set the exit code and
 * nothing else: it was consulted by the code chain and by no printed sentence,
 * which is how a run with a failing suite and a correct table came to close on
 * 'Every number the README states is the number the suites run.' Saying it once,
 * here, at the place the finding is collected, is what makes the last line and
 * the exit code agree without either of them being written twice.
 */
const failingSuites = {
  failing: true,
  heading: 'Measured from a suite that is failing. The counts stand; the tests do not:\n',
  lines: [...red].map(([name, counts]) => `  ${name}: ${counts.failed} of ${counts.total} failing`),
  epilogue: problems.length === 0 ? '\nThe numbers agree. The suites do not all pass.' : '',
};

/** A row of the table that is not the number its suite runs. */
const stale = {
  failing: true,
  lines: problems.map((problem) => `  ${problem}`),
  epilogue: write
    ? '\nWhat is left is not arithmetic: a row added or removed says what a package is for.'
    : '\nA number kept by hand is a number that will eventually be wrong. Fix it with --write.',
};

/** A package that ran and could not be read: the absence of a measurement. */
const unmeasured = {
  failing: true,
  heading: 'No measurement at all for these — nothing to compare README against:\n',
  lines: [...unreadable].map(([name, error]) => `  ${name}: ${error.message}`),
  epilogue: `\n${unreadable.size} suite(s) produced no readable report. That is not a stale number; it is a missing measurement.`,
};

process.exitCode = finish({
  sections: [qualified, failingSuites, stale, unmeasured],
  // Withheld when one of the two qualifying sentences already spoke: those are
  // the arms this one used to share a chain with, and a chain prints one arm.
  // `finish` withholds it for the other reason — that something failing spoke —
  // which is the half this file kept getting wrong on its own.
  allClear: qualified.lines.length > 0 ? '' : 'Every number the README states is the number the suites run.',
});

// Three outcomes, three exit codes, because they ask for three different
// things from whoever is reading. 1 says the check has an answer and the answer
// is that something disagrees — retype the table, or fix the failing suite. 2
// says the check has no answer for at least one package, which no amount of
// editing README will settle. The distinction is the point of that pass: the
// old code reported both of them, and the ordinary case of a single red
// assertion, as the same thing — a stack trace.
//
// The reporter returns 0 or 1, because those are the only two things a closing
// sentence can be. 2 is not a third verdict on the same question, it is a
// different question — was there anything to measure — so it is raised here,
// after the sentence has been printed, over the section that reported it. This
// cannot overwrite a decision to fail: `unmeasured` is a failing section, so
// `finish` had already returned 1 on every run that reaches this line.
if (unreadable.size > 0) process.exitCode = 2;
