#!/usr/bin/env node
/**
 * The board references in the traditional text, against every translation.
 *
 * The plans talk about the board — "(field 72)", "boxes 38, prana, 39, apana",
 * "until he reaches field 68" — and plan 9 argues from arithmetic:
 * `9x5=45=9; 9x6=54=9; …`. A cross-reference whose number is gone points
 * nowhere, and an argument whose premises are gone is not an argument.
 *
 * The audit that came before this one checked terms: transliterations,
 * duplicate bodies, script density. It found nothing, and it was looking one
 * layer above the damage.
 *
 * What this found, in 23 plans across three languages: Ukrainian, Malay and
 * Arabic have lost board references in eight plans each. The loss is in the
 * donor translations themselves, not in this repository's generator.
 *
 * It said 42 across eight for a long time, and six of those were never lost.
 * This counts *digits*, and German, Spanish, Hindi, Marathi and Chinese write
 * those references as words — as does Ukrainian plan 60, whose sentence carries
 * the winning square in full, `шістдесят восьмий квадрат`, and was reported as
 * having dropped it. See `WRITTEN_OUT` in `lib/numbers.mjs`: every entry there
 * is a quotation from the file it came from, read before it was written down.
 *
 * It read 36 until the pass after that, when the terms of the multiplication
 * tables in plans 8 and 9 stopped being counted as cross-references to squares.
 * They never were: those tables are `audit-arithmetic`'s, and it holds them to
 * a stricter rule than presence. Taking them out left `ar/9: 72000` standing on
 * its own — a real reference, the nadis of the body, which had been buried in a
 * record of table rows.
 *
 * It read 31 until this one, and eleven of those numbers were never lost
 * either. Three records were a numbered list — plan 6 enumerates the four
 * possessions `1.` to `4.`, and dropping the numbering is a typographic choice.
 * The other eight were the same sentence spelled out in words in a language
 * nobody had read yet, and every one of them was found by the audit pointing at
 * itself: a number *some* translator wrote as a word is a number to check the
 * others for. See `alsoWrittenOutSomewhere`.
 *
 * The 23 are an upper bound for the same reason as before. What has been read
 * is what is excused — but the reading is now prompted rather than waited for,
 * and each record says whether the plan still names the square it has stopped
 * numbering, which is the difference between a numeral to put back and a
 * sentence to write.
 *
 * **It is recorded rather than repaired.** Repairing it means translating, and
 * translating means calling a service this repository deliberately does not
 * call. So the damage below is named on every run and the audit fails only on a
 * loss nobody has seen before — which is what a rebuild from a different source
 * would produce.
 *
 * Run:  node scripts/audit-numbers.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  alsoWrittenOutSomewhere,
  identifyingTerms,
  keyOf,
  kindOf,
  lossesIn,
  unrecorded,
} from './lib/numbers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'packages', 'content', 'data');

/**
 * Board references already known to be missing, as `language/plan: numbers`.
 *
 * Every line is a sentence in a shipped translation that refers to a square and
 * does not say which. They are here so that a rebuild cannot add a forty-third
 * quietly, and so that anyone re-translating knows exactly what to look for.
 */
const RECORDED = [
  'ar/9: 72000',
  'ar/30: 38,39,40',
  'ar/38: 24',
  'ar/44: 37',
  'ar/46: 45',
  'ar/51: 72',
  'ar/55: 52',
  'ar/61: 21',
  'ms/30: 38,39,40',
  'ms/38: 24',
  'ms/44: 37',
  'ms/46: 45',
  'ms/51: 72',
  'ms/55: 52',
  'ms/61: 21',
  'uk/23: 11',
  'uk/30: 38,39,40',
  'uk/38: 24',
  'uk/44: 37',
  'uk/46: 45',
  'uk/51: 72',
  'uk/55: 52',
  'uk/61: 21',
];

const read = (language) => JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'));

/**
 * What kind of loss a record is, said per number rather than per plan.
 *
 * Two very different things had been recorded under one word. Malay keeps the
 * sentence and drops the numeral — plan 30 still names `prana` and `apana`,
 * pointing at squares it no longer numbers. Ukrainian drops the parenthetical
 * whole: plan 30 has no `прана`, `апана` or `вьяна` in it anywhere. One repair
 * is a numeral put back where a sentence already points; the other is a
 * sentence to write.
 *
 * This used to be five lines somebody had read, and read is better than
 * guessed. But five of thirty-one is a sample rather than a record, and it was
 * wrong in one of the five: `ms/60` was written down as *the sentence is still
 * there* when the sentence has the number in it, in words. Deriving it says
 * something about every record, including the ones nobody will get to.
 *
 * A record covering three squares can be three different losses, and the plan
 * this came from is exactly that: `uk/30` lost all three, `ms/30` and `ar/30`
 * kept two of them and lost `vyana`. Recorded per plan, that is one line saying
 * one thing about three squares.
 */
function describe(body, numbers, terms) {
  const said = numbers
    .map((number) => [number, kindOf(body, Number(number), terms)])
    .filter(([, verdict]) => verdict !== null)
    .map(([number, verdict]) =>
      verdict.kind === 'numeral only'
        ? `${number} is still named (${verdict.names.join(', ')})`
        : `${number} is not named at all`,
    );

  const words = numbers.filter((number) => alsoWrittenOutSomewhere(Number(number)));
  if (words.length > 0) {
    said.push(`${words.join(',')} is written out in words somewhere — read this one too`);
  }

  return said;
}

const languages = readdirSync(DATA)
  .filter((file) => /^plans\..+\.json$/.test(file))
  .map((file) => file.slice('plans.'.length, -'.json'.length))
  .sort();

const russian = read('ru');
const english = read('en');

const found = [];
const evidence = new Map();
for (const language of languages) {
  // The two editions are what everything else is measured against, and a number
  // is only expected of a translation when both of them carry it.
  if (language === 'ru' || language === 'en') continue;

  const plans = read(language);
  // The edition's own titles, so that what a term means is asked of the
  // translation being judged rather than of the English one.
  const terms = identifyingTerms(plans);
  const bodies = new Map(plans.map((plan) => [plan.plan, plan.body ?? '']));

  for (const loss of lossesIn(plans, russian, english, language)) {
    const line = keyOf(language, loss);
    found.push(line);
    evidence.set(line, describe(bodies.get(loss.plan) ?? '', loss.lost, terms));
  }
}

const news = unrecorded(found, RECORDED);
const healed = RECORDED.filter((line) => !found.includes(line));

console.log(`\nChecked ${languages.length} languages for the board references both editions state.\n`);

if (found.length > 0) {
  console.log(`Already known to be missing, in ${found.length} plans:`);
  for (const line of found) {
    console.log(`  ${line}`);
    for (const note of evidence.get(line) ?? []) console.log(`      ${note}`);
  }
  console.log('');
}

if (healed.length > 0) {
  console.log('Recorded as missing and now present — take these out of RECORDED:');
  for (const line of healed) console.log(`  ${line}`);
  console.log('');
}

if (news.length === 0) {
  console.log('No board reference has gone missing that was not already recorded.');
} else {
  console.log('These are new:');
  for (const line of news) console.log(`  ${line}`);
  console.log('\nA cross-reference without its number points nowhere.');
  process.exitCode = 1;
}
