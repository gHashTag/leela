#!/usr/bin/env node
/**
 * The rules book's table of contents, in every language.
 *
 * `audit-dataset` checks that a chapter is written in the script it is filed
 * under — it caught an English book carrying a Russian seventh chapter. Nothing
 * asked whether the book has the same *chapters* everywhere, and it does not.
 *
 * Ukrainian, Malay and Arabic carry `online` — a chat-moderation policy, "the
 * following topics are strictly forbidden: racism, nazism, drugs" — and
 * `foreword`, and have **no chapter on the chakras**. Two of the three have no
 * chapter on the meaning of the game either. They are the same three languages
 * that came from the English edition rather than the Russian one, found in the
 * pass before this: a different donor, a different contents page.
 *
 * A reader in those languages opened the rules and the chakras were simply not
 * there, while every other book had them. `bookFor` now borrows the English
 * chapter and marks it borrowed, so nobody is left without the teaching and
 * nobody is told a translation exists that does not. Completing the books
 * themselves means translating, which needs a service this repository
 * deliberately does not call.
 *
 * Extra chapters are not a fault: `online` and `foreword` are real text.
 *
 * Run:  node scripts/audit-book.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gaps, keyOf, sharedChapters, unrecorded } from './lib/book.mjs';
import { finish } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'packages', 'content', 'data');

/** Books already known to be missing a chapter the two editions agree on. */
const RECORDED = ['ar: chakras', 'ms: meaning,chakras', 'uk: meaning,chakras'];

const books = JSON.parse(readFileSync(join(DATA, 'rules.json'), 'utf8'));
const shared = sharedChapters(books.en ?? [], books.ru ?? []);

if (shared.length === 0) {
  console.error('The two editions share no chapters at all, so there is nothing to check.');
  process.exit(1);
}

const found = gaps(books, shared);
const lines = found.map(keyOf);
const news = unrecorded(lines, RECORDED);
const healed = RECORDED.filter((line) => !lines.includes(line));

console.log(
  `\nChecked ${Object.keys(books).length} books against the ${shared.length} chapters both editions teach.\n`,
);

// *This printed and exited zero, which is the defect audit-numbers carried for
// a hundred passes* — printed here, above an all-clear that asked only about
// `news`, by a script carrying the defect it was naming. The arrangement is
// `lib/report.mjs`'s now, so the sentence and the exit code are decided in one
// place instead of being restated in a fourth epilogue.
process.exitCode = finish({
  allClear: 'No book is missing a chapter that was not already recorded.',
  sections: [
    {
      failing: true,
      heading: 'Recorded as missing and now present — take these out of RECORDED:',
      lines: healed.map((line) => `  ${line}`),
      epilogue:
        '\nA record that outlives its reason is a licence issued for something else:\n' +
        'the next book to lose this chapter passes on it. This printed and exited\n' +
        'zero, which is the defect audit-numbers carried for a hundred passes.',
    },
    {
      failing: true,
      heading: 'These are new:',
      lines: news.map((line) => `  ${line}`),
      epilogue:
        '\nA teaching no reader in that language can reach is a teaching they do not have.',
    },
    {
      failing: false,
      heading: 'Missing chapters the reader is owed (borrowed from English at runtime):',
      lines: found.map((gap) => {
        const instead = gap.extra.length > 0 ? `, and carries ${gap.extra.join(',')} instead` : '';
        return `  ${gap.language}: no ${gap.missing.join(', ')}${instead}`;
      }),
    },
  ],
});
