#!/usr/bin/env node
/**
 * The sums the traditional text states, in every language it is shipped in.
 *
 * The translation audit has two layers already. The first checked terms and
 * found nothing. The second checked whether a board reference survived and
 * found losses in three languages — and could not repair one of them, because
 * repairing a translation means translating.
 *
 * This is the layer that needs no translator at all. Plan 9 argues from
 * arithmetic and plan 8 from the opposite arithmetic, and whether nine times
 * two hundred and eighty is two thousand five hundred and twenty is the same
 * question in Ukrainian, Malay and Arabic as it is here.
 *
 * **What it found.** Three languages state `9х280=7,380`. It is 2520. All three
 * follow the English edition, and the English donor in `leela-src` carries the
 * same false line — so this is inherited rather than introduced here, which is
 * checkable and was checked. The shipped English follows the Russian edition
 * and says 2520.
 *
 * **Recorded rather than repaired**, as the missing references above it are.
 * Correcting a number in a shipped translation is a decision about content in
 * three languages, and this audit's job is to make it impossible to miss rather
 * than to make it quietly. A fourth false sum fails the run.
 *
 * Run:  node scripts/audit-arithmetic.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { falseClaimsIn, keyOf } from './lib/arithmetic.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'packages', 'content', 'data');

/**
 * False sums already known, as `language/plan: what it says`.
 *
 * Empty, and it was not always. Ukrainian, Malay and Arabic each stated
 * `9х280=7,380` — inherited from the English donor, which carries the same
 * false line — in the plan whose entire argument is that nine keeps its
 * identity under multiplication. They say `2,520` now, in the grouping each
 * file already used, and nothing else in the sentence was touched: the correct
 * digits are what arithmetic says they are, in every language at once, and no
 * translator was needed to know them.
 *
 * A list that empties is the point of keeping one. It stays here for the next
 * sum that turns out to be wrong.
 */
const RECORDED = [];

const languages = readdirSync(DATA)
  .filter((file) => file.startsWith('plans.') && file.endsWith('.json'))
  .map((file) => file.slice('plans.'.length, -'.json'.length))
  .sort();

const found = [];
let equations = 0;

for (const language of languages) {
  const plans = JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'));
  for (const claim of falseClaimsIn(plans)) {
    found.push({ language, claim, line: keyOf(language, claim) });
  }
  equations += plans.length;
}

const known = new Set(RECORDED);
const fresh = found.filter(({ line }) => !known.has(line));

console.log(`\nChecked the arithmetic in ${languages.length} languages.\n`);

if (found.length > 0) {
  console.log('False sums, all of them already recorded:\n');
  for (const { line, claim } of found) {
    console.log(`  ${line}  —  ${claim.faults.join('; ')}`);
  }
}

if (fresh.length === 0) {
  console.log('\nNo sum is wrong that was not already written down.');
} else {
  console.log('\nAnd these are new:\n');
  for (const { line, claim } of fresh) console.log(`  ${line}  —  ${claim.faults.join('; ')}`);
  console.log('\nA sum is true or false in every language at once. This one is false.');
  process.exitCode = 1;
}
