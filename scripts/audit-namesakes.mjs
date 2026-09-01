#!/usr/bin/env node
/**
 * No two squares of the board are told to a player by one name.
 *
 *     node scripts/audit-namesakes.mjs
 *
 * Written 2026-08-29, after reading the Urdu edition of the book and finding
 * plan 4 and plan 8 both called *لالچ*. A player throws, lands on 8, and is
 * told what they were told on 4; the number is the only thing separating them,
 * and the number is what the board already showed.
 *
 * MEASURED: thirty findings in seventeen of the twenty-two languages, in five
 * pairs. The Russian edition — written rather than translated — names all five
 * distinctly, so this is not the board having two squares for one idea.
 *
 * **The root is in the English.** Russian plan 8 is «Алчность (матсара или
 * матсаръя)»; the English donor renders it bare *"Greed"*, which is what it
 * calls plan 4, and sixteen machine translations inherited the collision.
 *
 * Recorded rather than repaired, on `corrections.mjs`'s bar: choosing an
 * English word for plan 8 is a translator's decision. So this audit holds the
 * record exact in both directions — a new collision fails it, and so does a
 * record that has stopped describing anything.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { finish } from './lib/report.mjs';
import { against, lineOf, namesakesIn } from './lib/namesakes.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'packages/content/data');

const languages = readdirSync(DATA)
  .filter((name) => name.startsWith('plans.') && name.endsWith('.json'))
  .map((name) => name.slice('plans.'.length, -'.json'.length))
  .sort();

const found = [];
for (const language of languages) {
  const plans = JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'));
  for (const namesake of namesakesIn(plans)) {
    found.push({ language, ...namesake });
  }
}

// The record is kept by pair and language; the line a finding spells carries
// the name as well, which is what a reader needs and what the record does not
// pin — a translation may change the word and keep the collision.
const { fresh, rotted } = against(found.map(({ language, plans }) => `${language} plans ${plans.join(' and ')}`));

process.exitCode = finish({
  allClear:
    'No language calls two plans by one name that is not already written down, ' +
    'and every collision written down is still there.',
  sections: [
    {
      failing: false,
      lines: [
        `\nRead ${languages.length} languages for two plans sharing a name.`,
        `${found.length} found, all recorded in scripts/lib/namesakes.mjs with why each is left alone.`,
        ...found
          .slice()
          .sort((one, other) => one.plans[0] - other.plans[0])
          .map((one) => `  ${lineOf(one.language, one)}`),
      ],
    },
    {
      failing: true,
      heading: `\n${fresh.length} collision(s) nobody has written down:\n`,
      lines: fresh.map((line) => `  ${line}`),
      epilogue:
        '\nRecord it in scripts/lib/namesakes.mjs, with why it is left alone.\n' +
        'Repairing means choosing what a plan is called in that language, which\n' +
        'is a translator’s decision and not this repository’s.',
    },
    {
      failing: true,
      heading: `\n${rotted.length} record(s) matching nothing in the data:\n`,
      lines: rotted.map((line) => `  ${line}`),
      epilogue:
        '\nThe collision is gone — a title was fixed, or a plan renamed. Take the\n' +
        'entry out, or the record is a claim about the data that the data denies.',
    },
  ],
});
