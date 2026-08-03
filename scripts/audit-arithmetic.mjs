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
import {
  equationsIn,
  factorisationsIn,
  falseClaimsIn,
  keyOf,
  OPERATORLESS_RECORDED,
  operatorlessClaimsIn,
  staleRecords,
} from './lib/arithmetic.mjs';

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

/**
 * Sums whose multiplication sign the translation lost, as `language/plan: said`.
 *
 * Plan 8's run ends in a sentence rather than in the list — *when an 8 is
 * multiplied by a 9 it becomes a 9 (8x9=72), and in the next cycle it returns
 * to its original state, 8x10=80=8* — and the machine translation ate the sign
 * there in two languages. Nothing had ever seen these: every reader above finds
 * a sum by its sign, so a sum without one is not a sum to them, and it is not a
 * missing sum either. It is prose with numbers in it.
 *
 * **One of the four was repairable and is gone from this list.** Malay's
 * `8 9 = 72` had both operands, the product, and only one operation that makes
 * it true — 8+9 is 17 and 8−9 is −1 — so putting the sign back needed
 * arithmetic and no translator, which is the bar in `lib/corrections.mjs`. It
 * is corrected there and the audit now checks it like any other sum.
 *
 * The three below do not clear that bar, and saying why is the point of writing
 * them down rather than repairing them quietly:
 *
 * - `ms/8: 8 80 = 80 = 8` — the English is `8x10=80, 8+0=8`. The `10` is not in
 *   the text at all and there is an `80` too many, so restoring it means writing
 *   a number the translation does not contain and deciding which of the two
 *   eighties is the product. That is a reading, not a calculation.
 * - `ar/8: 8 9 9 = 72` — three numbers for a two-operand claim. `8x9=72` and a
 *   trailing `9` is the digital root, which is how the English writes it
 *   (`8x9=72, 7+2=9`); but deciding that is deciding what the machine did to
 *   the sentence, and a different ordering is as consistent with what is left.
 * - `ar/8: 81 10 = 80 = 8` — `81` has to become `8` before anything else is
 *   true. One digit too many is a plausible reading and not a derivable one.
 *
 * Recorded, named on every run, and a fifth fails the audit.
 */
const OPERATORLESS = OPERATORLESS_RECORDED;

const languages = readdirSync(DATA)
  .filter((file) => file.startsWith('plans.') && file.endsWith('.json'))
  .map((file) => file.slice('plans.'.length, -'.json'.length))
  .sort();

const found = [];
const broken = [];
let equations = 0;

for (const language of languages) {
  const plans = JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'));
  for (const claim of falseClaimsIn(plans)) {
    found.push({ language, claim, line: keyOf(language, claim) });
  }
  for (const claim of operatorlessClaimsIn(plans)) {
    broken.push({ language, line: keyOf(language, claim) });
  }
  // Counted rather than assumed. This used to add `plans.length` under the name
  // `equations` and print nothing, so the audit said "checked the arithmetic in
  // 22 languages" while nothing said how much arithmetic there was — and a
  // parser that had stopped matching would have reported exactly the same
  // sentence.
  for (const plan of plans) {
    equations += equationsIn(plan.body ?? '').length + factorisationsIn(plan.body ?? '').length;
  }
}

const known = new Set(RECORDED);
const fresh = found.filter(({ line }) => !known.has(line));
const newlyBroken = broken.filter(({ line }) => !new Set(OPERATORLESS).has(line));
// A record excuses a defect; once the defect is gone the excuse is still
// granted, and the next sum that reads the same way is waved through on a
// licence issued for something else.
const stale = staleRecords(OPERATORLESS, broken.map(({ line }) => line));
// The same question of the list above it, which had never been asked. It is
// empty today, so nothing is stale — and the first false sum recorded in it
// would have outlived its repair in silence, which is the whole defect.
const staleFalse = staleRecords(RECORDED, found.map(({ line }) => line));

console.log(
  `\nChecked ${equations} sums in ${languages.length} languages, and every plan for a sum whose operator is gone.\n`,
);

if (staleFalse.length > 0) {
  console.log('These recorded false sums no longer match anything:');
  for (const line of staleFalse) console.log(`  ${line}`);
  console.log('\nA repaired sum keeps its excuse, and the next one that reads the same way\npasses on it. Take them out.\n');
  process.exitCode = 1;
}

if (found.length > 0) {
  console.log('False sums, all of them already recorded:\n');
  for (const { line, claim } of found) {
    console.log(`  ${line}  —  ${claim.faults.join('; ')}`);
  }
}

if (broken.length > 0) {
  console.log('Sums whose operator the translation dropped, all of them recorded:\n');
  for (const { line } of broken) console.log(`  ${line}`);
  console.log('');
}

if (fresh.length === 0 && newlyBroken.length === 0 && stale.length === 0) {
  console.log('No sum is wrong or unreadable that was not already written down.');
} else {
  if (fresh.length > 0) {
    console.log('\nAnd these sums are new:\n');
    for (const { line, claim } of fresh) console.log(`  ${line}  —  ${claim.faults.join('; ')}`);
    console.log('\nA sum is true or false in every language at once. This one is false.');
  }
  if (stale.length > 0) {
    console.log('\nAnd these records no longer match anything:\n');
    for (const line of stale) console.log(`  ${line}`);
    console.log(
      '\nA record grants an excuse. Once what it names is gone the excuse is still\n' +
        'granted, and the next sum that reads the same way passes on a licence issued\n' +
        'for something else. Delete the record in the same change that repairs the sum.',
    );
  }
  if (newlyBroken.length > 0) {
    console.log('\nAnd these have lost their operator:\n');
    for (const { line } of newlyBroken) console.log(`  ${line}`);
    console.log(
      '\nA sum with no sign in it is not checked and not reported missing — it reads as\n' +
        'prose with numbers in it, which is where this check was blind.',
    );
  }
  process.exitCode = 1;
}
