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
 * What this found, after five false alarms were closed: **two**. Arabic plan 9
 * has lost the 72,000 nadis and Ukrainian plan 23 has lost the square heaven
 * points at. Both are in the donor translations themselves, not in this
 * repository's generator, and both were read in the file they come from.
 *
 * It began at 42 across eight languages. Every number that came off the list
 * came off because the check was asking the wrong question, not because
 * anything was repaired — which is the whole reason to keep writing down what
 * a check believes.
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
 * They never were: those tables are `audit-arithmetic`'s, which checks every
 * product it can read. Taking them out left `ar/9: 72000` standing on
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
 * It read 23 until this one, and twenty-one of those were **the third false
 * alarm, closed against the wrong English**. *Not every language was translated
 * from the same edition* was known and acted on — by comparing everything to
 * the one English this dataset ships. Arabic, Malay and Ukrainian come from
 * `leela/src/locales/<lang>`, whose sibling is `leela/src/locales/en`: an older,
 * shorter edition the generator reads and throws away. It says *the snake of
 * tamoguna* where the shipped English says *the tamoguna square (field 72)*.
 * Twenty-one lines of recorded damage were translations faithfully carrying
 * sentences that never had a number in them.
 *
 * That edition is now kept under `data/editions/`, and which one a language
 * followed is read off its own plans — every plan carries the file it came
 * from, so no list of language codes is kept by hand.
 *
 * The two are what is left. What has been read is what is excused — but the
 * reading is now prompted rather than waited for, and each record says whether
 * the plan still names the square it has stopped numbering, which is the
 * difference between a numeral to put back and a sentence to write.
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
  LOSSES_RECORDED,
  alsoWrittenOutSomewhere,
  editionOf,
  identifyingTerms,
  keyOf,
  kindOf,
  lossesIn,
  staleRecords,
  unrecorded,
} from './lib/numbers.mjs';
import { finish } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'packages', 'content', 'data');

/**
 * Board references already known to be missing, as `language/plan: numbers`.
 *
 * The list itself is `LOSSES_RECORDED` in `lib/numbers.mjs`, beside the readers
 * and beside the test that holds it. It was here, which meant the test kept a
 * second copy written by hand — the arrangement `lib/arithmetic.mjs` had
 * already been burned by once.
 */
const RECORDED = LOSSES_RECORDED;

const read = (language) => JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'));

/** An edition nothing ships, kept by the generator for exactly this question. */
const readEdition = (name) =>
  JSON.parse(readFileSync(join(DATA, 'editions', `${name}.json`), 'utf8'));

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
const uncovered = [];
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

  // And the edition it was translated from, for the same reason one level up.
  // Three languages come from the published app's locales, whose English says
  // *the snake of tamoguna* where the shipped English says *the tamoguna square
  // (field 72)* — so twenty-one lines of recorded damage were a translation
  // faithfully carrying a sentence that never had a number in it.
  const edition = editionOf(plans);
  const against = edition ? readEdition(edition) : english;

  // An edition that does not cover a plan makes every number in it unexpected,
  // so `lossesIn` skips it and this audit reports nothing about it — which
  // reads exactly like a language with nothing wrong. That is the shape this
  // repository has now been caught by three times, and an edition file is a
  // generated one: a rebuild from a source directory that had moved would empty
  // it and turn the whole check green.
  for (const plan of plans) {
    if (!against.some((one) => one.plan === plan.plan)) {
      uncovered.push(`${language}/${plan.plan}: ${edition ?? 'en'} has no such plan`);
    }
  }

  for (const loss of lossesIn(plans, russian, against, language)) {
    const line = keyOf(language, loss);
    found.push(line);
    evidence.set(line, describe(bodies.get(loss.plan) ?? '', loss.lost, terms));
  }
}

const news = unrecorded(found, RECORDED);
const healed = staleRecords(RECORDED, found);

console.log(`\nChecked ${languages.length} languages for the board references both editions state.\n`);

// The standing losses, each with what was read about it underneath.
const standing = [];
for (const line of found) {
  standing.push(`  ${line}`);
  for (const note of evidence.get(line) ?? []) standing.push(`      ${note}`);
}

const capped = uncovered.slice(0, 20).map((line) => `  ${line}`);
if (uncovered.length > 20) capped.push(`  … and ${uncovered.length - 20} more`);

// This is the file the sentence below was written about. *This printed and
// exited zero for a hundred and ninety-nine passes, so nothing ever read it*
// stood directly above an all-clear condition that asked about `news` and
// `uncovered` and knew nothing of `healed` — so the run that finally noticed a
// healed record would have said, as its last line, that nothing had gone
// missing. `lib/report.mjs` now decides the ordering and the exit code
// together, from one list.
process.exitCode = finish({
  allClear: 'No board reference has gone missing that was not already recorded.',
  sections: [
    {
      failing: true,
      heading: 'Recorded as missing and now present — take these out of RECORDED:',
      lines: healed.map((line) => `  ${line}`),
      epilogue:
        '\nA record that outlives its reason is a licence issued for something else:\n' +
        'the next translation to lose these numbers passes on it. This printed and\n' +
        'exited zero for a hundred and ninety-nine passes, so nothing ever read it.',
    },
    {
      failing: true,
      heading: 'An edition does not cover plans the translation has:\n',
      lines: capped,
      epilogue:
        '\nA plan the edition lacks is a plan nothing is expected of, so every number in\n' +
        'it is excused — and a silent excuse reads exactly like a language with nothing\n' +
        'wrong. The editions are generated; an emptied one turns this whole check green.',
    },
    {
      failing: true,
      heading: 'These are new:',
      lines: news.map((line) => `  ${line}`),
      epilogue: '\nA cross-reference without its number points nowhere.',
    },
    {
      failing: false,
      heading: `Already known to be missing, in ${found.length} plans:`,
      lines: standing,
    },
  ],
});
