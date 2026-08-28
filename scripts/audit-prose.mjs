#!/usr/bin/env node
/**
 * Nothing a reader is shown is markup, and no plan stops mid-sentence.
 *
 *     node scripts/audit-prose.mjs
 *
 * Written 2026-08-29, after the Malay sixth plan was found carrying a
 * paragraph reading `& Nbsp; & nbsp; & nbsp; & nbsp;` — four broken HTML
 * entities standing between *"Keempat-empat ini dipanggil"* and the list they
 * were meant to space out. Both donors of the Malay text have it, so the
 * translator broke the markup and the generator passed it on faithfully.
 * `lib/corrections.mjs` removes it; this is what notices the next one.
 *
 * **THE SWEEP THAT MISSED IT LOOKED FOR `&nbsp;`.** Nothing in 1,584 bodies
 * matched, because a translator that mangles an entity does not leave it
 * canonical. What found it was the count: `&` occurs in exactly one plan of
 * 1,584. `lib/prose.mjs` reads the defect rather than its tidy spelling.
 *
 * Static, over the shipped data, so it runs anywhere and needs nothing.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { finish } from './lib/report.mjs';
import { proseProblems } from './lib/prose.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'packages/content/data');

const languages = readdirSync(DATA)
  .filter((name) => name.startsWith('plans.') && name.endsWith('.json'))
  .map((name) => name.slice('plans.'.length, -'.json'.length))
  .sort();

const problems = [];
let read = 0;

for (const language of languages) {
  for (const plan of JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8'))) {
    read += 1;
    problems.push(...proseProblems({ language, ...plan }));
  }
}

process.exitCode = finish({
  allClear: 'Every plan reads as prose and finishes its last sentence.',
  sections: [
    {
      failing: false,
      lines: [
        `\nRead ${read} plans in ${languages.length} languages for markup left in the text` +
          ' and for a body that stops mid-sentence.',
      ],
    },
    {
      failing: true,
      heading: `\n${problems.length} thing(s) a reader would see that are not words:\n`,
      lines: problems.map((one) => `  ${one}`),
      epilogue:
        '\nIf the donor carries it, the repair goes in scripts/lib/corrections.mjs —\n' +
        'and only if removing it removes no words, which is the line that file draws.\n' +
        'A paragraph of broken entities qualifies; a sentence somebody wrote does not.',
    },
  ],
});
