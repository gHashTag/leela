#!/usr/bin/env bun
/**
 * Find every copy of the board across the source repositories, and check it.
 *
 * The rules were copied ten times over 25 repositories. One of those copies —
 * `NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` — turned out to be a
 * 100-square Snakes and Ladders set rather than Leela, and nothing caught it
 * because nothing looked. This looks.
 *
 * Runs under bun, not node. It imports the engine's TypeScript source, and the
 * engine imports `./board` without an extension — which a bundler, bun and tsc
 * all resolve and node does not. The shebang says so, and
 * `scripts/audit-scripts.mjs` holds the docs to it: this script spent some time
 * documented as `node scripts/audit-copies.mjs`, a command that dies in the
 * loader, and nobody noticed because a check nobody can run reads exactly like
 * a check that passes.
 *
 * Needs: the donor clones in ../leela-src, which CI does not check out.
 *
 * Run:  bun scripts/audit-copies.mjs [--src ../leela-src]
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditBoard,
  compareToReference,
  declaresBoard,
  describeProblems,
  detectRules,
  extractBoards,
} from '../packages/engine/src/index.ts';
import {
  RECORDED,
  absentDonors,
  against,
  agreesWithEngine,
  censusLines,
  inventoryFrom,
  markFor,
  nameOf,
  presentDirectories,
  renderResult,
  withCoverage,
} from './lib/copies.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : join(HERE, '..', '..', 'leela-src');

const SKIP = new Set(['node_modules', '.git', 'build', 'generated', 'dist', 'ios', 'android']);
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.sol'];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);

    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }

    if (stats.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}


if (!existsSync(SRC)) {
  console.error(`No source directory at ${SRC}. Clone the repositories, or pass --src.`);
  process.exit(1);
}

/**
 * How much of the donor tree is here to be read.
 *
 * This walked `../leela-src` and reported eighteen copies without ever saying
 * eighteen copies out of what. Fifteen of the twenty-five repositories
 * MIGRATION.md inventories are on this disk; ten are not, and one of them is
 * `leelachakra`, the original React Native app — the first generation of the
 * game whose rules this whole audit compares against.
 *
 * Read out of MIGRATION.md rather than listed here, and the count MIGRATION.md
 * states in words is checked against the count parsed out of it, so a parse
 * that goes wrong says so instead of shrinking the denominator quietly.
 *
 * Absence does not fail the run. The ten cannot be cloned from in here, and an
 * audit that can only be red is one somebody deletes rather than obeys. What
 * was wrong was the claim of coverage, and that is what changes.
 */
const inventory = inventoryFrom(readFileSync(join(HERE, '..', 'MIGRATION.md'), 'utf8'));
const present = presentDirectories(readdirSync(SRC, { withFileTypes: true }));
const absent = absentDonors(inventory.donors, present);
const inventoried = inventory.donors.length;

const results = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const { snakes, arrows, count } = extractBoards(source);
  // A stray pair or two is a coincidence, not a board.
  if (count < 5) continue;
  const total = count;

  results.push({
    file: relative(SRC, file),
    jumps: total,
    problems: auditBoard(snakes, arrows),
    differences: compareToReference(snakes, arrows),
    rules: detectRules(source),
  });
}

results.sort((a, b) => a.file.localeCompare(b.file));

/**
 * Files that mention the board but yielded too few jumps to check.
 *
 * Reported rather than ignored: a scanner that quietly skips what it cannot
 * read is worse than no scanner, because it reads as coverage.
 */
const unparsed = [];
for (const file of walk(SRC)) {
  const relativePath = relative(SRC, file);
  if (results.some((r) => r.file === relativePath)) continue;

  const source = readFileSync(file, 'utf8');
  // Only files that actually declare a board: a test asserting about one
  // mentions every square and carries none, and reporting it would be noise.
  if (declaresBoard(source)) unparsed.push(relativePath);
}

console.log(`Found ${results.length} copies of the board under ${SRC}\n`);

let wrong = 0;
for (const result of results) {
  if (!agreesWithEngine(result)) wrong++;
  for (const line of renderResult(result, describeProblems)) console.log(line);
}

console.log(
  `\n${withCoverage(`${results.length - wrong} of ${results.length} copies agree with @leela/engine`, { inventoried, present: inventoried - absent.length })}`,
);

for (const line of censusLines(absent, inventoried)) console.log(line);

// The parse and the prose disagreeing is itself a finding: it means either a
// donor was added to the inventory in a shape this cannot read, or the stated
// total has drifted from the names under it. Said out loud rather than
// absorbed, because everything above is measured against this denominator.
if (inventory.declared !== null && inventory.declared !== inventoried) {
  console.log(
    `\nMIGRATION.md says ${inventory.declared} repositories and names ${inventoried}. The census above` +
      '\nis against the names, and one of the two is wrong.',
  );
}

// The boards mostly agree; the rules do not. Print them side by side, because
// a copy with the right board and no three-sixes rule is a different game
// wearing the same map.
const RULE_LABELS = {
  entryOnSix: 'entry on 6',
  threeSixesReset: '3 sixes',
  refusesOvershoot: 'no overshoot',
  winsOnExactLanding: 'win on 68',
  reportGate: 'report gate',
  rerollOnRepeat: 'reroll',
};

/**
 * Rules found anywhere in each repository, not only in the file with the board.
 *
 * The table used to print a dash for a rule `detectRules` did not find in the
 * copy it was reading, and a dash reads as "does not play that rule". The
 * published app's re-rolling die is in `DiceStore.ts` and its report gate is in
 * `OnlinePlayer.store` — neither anywhere near a board.
 */
const rulesPerFile = new Map();
for (const file of walk(SRC)) {
  const found = detectRules(readFileSync(file, 'utf8'));
  if (Object.values(found).some(Boolean)) rulesPerFile.set(relative(SRC, file), found);
}

console.log('\nRules each copy carries (`elsewhere`: not here, but in this repository):\n');
const keys = Object.keys(RULE_LABELS);
console.log(`${''.padEnd(52)}${keys.map((k) => RULE_LABELS[k].padEnd(14)).join('')}`);
for (const result of results) {
  const name = result.file.length > 50 ? `…${result.file.slice(-49)}` : result.file;
  const marks = keys
    .map((key) => markFor(key, result.file, result.rules, rulesPerFile).padEnd(14))
    .join('');
  console.log(`${name.padEnd(52)}${marks}`);
}

if (unparsed.length > 0) {
  console.log(`\n${unparsed.length} file(s) look like a board but could not be read:`);
  for (const file of unparsed) console.log(`  ${file}`);
  console.log('Check these by hand, or teach extractBoards their shape.');
}

/**
 * A board nobody could read is not a board that agrees.
 *
 * `unparsed` was collected, printed, and then governed nothing. It touched
 * neither the exit code below — which sees only `fresh` and `rotted` — nor the
 * closing sentence, which printed *12 of 18 copies agree with the engine* over
 * however many files `declaresBoard` had recognised and `extractBoards` had not.
 * The comment where it is collected has always said the right thing — *a
 * scanner that quietly skips what it cannot read is worse than no scanner,
 * because it reads as coverage* — and the run went on reading as coverage.
 *
 * `audit-claims` already decided this exact question in the other direction and
 * wrote down why: a package whose suite would not run is not a package with zero
 * tests, so it takes an exit code of its own — 2, *the check has no answer for
 * at least one of these, which no amount of editing will settle* — rather than
 * being folded into the ordinary disagreement at 1. The same two sentences apply
 * here word for word, so the same two codes are used, and the ordering is the
 * sibling's: an unreadable board is reported before a recorded one, because
 * nothing anybody does to `RECORDED` answers it.
 *
 * Set with `process.exit(...)`, a spelling the all-clear gate could not read
 * until 2026-08-06; that blind spot is now written down where the reader is, in
 * `packages/content/tests/a-closing-sentence-nothing-governs.test.ts`.
 */
const unreadable = unparsed.length > 0;

// The exit code is about the record, not about the count. Six of these copies
// disagree and none of them is ours to fix, so `wrong > 0` was true the day
// this was written and true every day since — a verdict that never moves is
// one nobody reads. See `against` in lib/copies.mjs.
const { fresh, rotted } = against(results);

if (fresh.length > 0) {
  console.log(`\n${fresh.length} copy(ies) disagree in a way nobody has recorded:`);
  for (const result of fresh) console.log(`  ${nameOf(result)}`);
  console.log('Read the file. Then add the line above to RECORDED, or fix what it describes.');
}

if (rotted.length > 0) {
  console.log(`\n${rotted.length} record(s) describe a copy that is no longer there:`);
  for (const line of rotted) console.log(`  ${line}`);
  console.log('A donor was fixed, a file moved, or a disagreement changed shape. Check, then drop it.');
}

if (fresh.length === 0 && rotted.length === 0 && unparsed.length === 0) {
  // The closing line is the one a reader quotes, so it carries the coverage.
  // "12 of 18 copies agree" was true and read as a statement about the game
  // rather than about the fifteen repositories anybody had on disk.
  //
  // And `unparsed.length === 0` for the same reason one step in: `results.length`
  // counts the boards this run could read, so "12 of 18" over a nineteenth file
  // nobody could parse is a denominator quietly shrunk to fit. The coverage
  // clause says which repositories were read; it cannot also say which files
  // inside them were, so the sentence is withheld rather than qualified.
  //
  // Spelled over `unparsed` rather than as `!unreadable`, which is the same
  // question and reads better, because the gate in
  // `a-closing-sentence-nothing-governs.test.ts` recognises an all-clear by the
  // shape of its condition — a claim of emptiness — and a negated boolean is not
  // that shape. With `!unreadable` here this file had no closing sentence the
  // gate could find and was skipped in silence; written out, it is read. A rule
  // one is exempt from by accident of spelling is a rule one is not held to.
  console.log(
    `\n${withCoverage(
      `${results.length - wrong} of ${results.length} copies agree with the engine, and the ` +
        `${RECORDED.length} that do not are the ${RECORDED.length} on record`,
      { inventoried, present: inventoried - absent.length },
    )}`,
  );
}

if (unreadable) {
  console.log(
    `\n${unparsed.length} file(s) declare a board this run could not read. That is not a copy that` +
      '\ndisagrees; it is a copy nobody measured, and the count above is of the rest.',
  );
  process.exit(2);
}

process.exit(fresh.length + rotted.length > 0 ? 1 : 0);
