#!/usr/bin/env node
/**
 * What the game offers a player, on each surface that is the game.
 *
 * Four passes running found the phone missing something its neighbours had, and
 * every one was found by reading rather than by anything failing: it wrote
 * accounts and showed none of them, it let a player at the die without asking
 * what they were playing for, it could hand a path out and not take one back.
 *
 * Each was a different defect and all of them were one shape — **a surface
 * quietly offering less than the game does**. This repository's premise is that
 * the surfaces differ in drawing and not in what the game asks or gives, so the
 * difference is worth a check rather than another four passes of noticing.
 *
 * Recorded rather than enforced, like the missing board references: the phone
 * is younger than the others and a gap is a decision about what to build next,
 * not a fault to block a build on. What is not allowed is a *new* one.
 *
 * Run:  node scripts/audit-offers.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** The surfaces that are the game. `apps/docs` is the book, not a game. */
const SURFACES = ['bot', 'miniapp', 'mobile'];

/**
 * What the game offers, and how to see that a surface offers it.
 *
 * The evidence is a call into a shared package, never a phrase or a filename:
 * what a surface *does* is which of the game's own functions it reaches for. A
 * name of its own proves nothing — three surfaces wrote three `mayThrow`s.
 */
const OFFERS = [
  { what: 'the plan a player stands on', by: /\bplanFor\b/ },
  // `bookFrom` alongside `bookFor` for the same reason the companion has two
  // spellings below: a phone cannot call `bookFor`, which reads every language
  // at once, so it fetches the two books it needs and hands them to the borrow
  // rule instead. Different call, same offering — and a check that named only
  // the server's spelling reported the mini app as having lost its rules book
  // the day the bundle was fixed.
  { what: 'the rules book', by: /\bbookFor\b|\bbookFrom\b|\brulesFor\b|\bruleChapter\b/ },
  { what: 'the question the game answers', by: /\bisIntention\b/ },
  { what: 'an account of the square', by: /\brecord\b|\bsubmitReport\b/ },
  { what: 'reading that account back', by: /\bwritingsOn\b|\bpathFor\b|\bhistory\b/ },
  { what: 'carrying the path away', by: /\btoDocument\b|\btoShare\b/ },
  { what: 'taking a path back', by: /\bparseDocument\b/ },
  { what: 'one square, shared', by: /\bparseSquare\b|\bsquareText\b/ },
  // Two ways of offering one thing, and the check has to see both. The bot
  // calls `@leela/ai` itself; the mini app cannot — a browser bundle has no
  // business holding an API key — so it hands the square to the bot through
  // Telegram's `sendData` and the answer comes back in the chat. Looking only
  // for the import reported that the mini app has no companion, which is a
  // check describing how a thing is built rather than whether it is offered.
  { what: 'the companion', by: /from '@leela\/ai'|sendData/ },
];

/**
 * Gaps already known, as `surface: what`.
 *
 * The phone is the youngest surface and these are what it has not been given
 * yet. Written down so that the next one to appear is visible the day it does.
 */
const RECORDED = ['mobile: the companion'];

/**
 * The code, with the prose taken out.
 *
 * Half of this repository is comments about what went wrong, and they quote the
 * names of the things that went wrong. The first version of this check read
 * them and reported that the phone offers a companion, on the strength of a
 * sentence in `journal.ts` mentioning `@leela/ai` — a check fooled by prose
 * says a surface has what it does not.
 */
function codeIn(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function filesUnder(directory) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }

  for (const entry of entries) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (/\.tsx?$/.test(entry)) found.push(path);
  }

  return found;
}

const code = Object.fromEntries(
  SURFACES.map((surface) => [
    surface,
    filesUnder(join(ROOT, 'apps', surface, 'src'))
      .map((path) => codeIn(readFileSync(path, 'utf8')))
      .join('\n'),
  ]),
);

const gaps = [];
for (const { what, by } of OFFERS) {
  for (const surface of SURFACES) {
    if (!by.test(code[surface])) gaps.push(`${surface}: ${what}`);
  }
}

const known = new Set(RECORDED);
const fresh = gaps.filter((gap) => !known.has(gap));
const mended = RECORDED.filter((gap) => !gaps.includes(gap));

console.log(`\nChecked ${OFFERS.length} things the game offers, on ${SURFACES.length} surfaces.\n`);

for (const { what } of OFFERS) {
  const row = SURFACES.map((surface) => (gaps.includes(`${surface}: ${what}`) ? '—' : 'yes'));
  console.log(`  ${what.padEnd(30)} ${row.map((cell) => cell.padEnd(9)).join('')}`);
}
console.log(`  ${''.padEnd(30)} ${SURFACES.map((s) => s.padEnd(9)).join('')}\n`);

// The table above stays where it is: it is the picture of the whole run and it
// is read from the top. What follows it is arranged by `lib/report.mjs`, which
// exists because *printing this and exiting zero is the defect audit-numbers
// carried for a hundred passes* was printed here, by a script whose own
// all-clear asked only about `fresh` and knew nothing of `mended`.
process.exitCode = finish({
  allClear: 'No surface offers less than it did, and the gaps are the ones written down.',
  sections: [
    {
      failing: true,
      heading: 'Recorded as missing and now offered — take these out of RECORDED:',
      lines: mended.map((gap) => `  ${gap}`),
      epilogue:
        '\nA surface that gained something and kept its excuse can lose it again in\n' +
        'silence: the record still says the gap is known. Printing this and exiting\n' +
        'zero is the defect audit-numbers carried for a hundred passes.',
    },
    {
      failing: true,
      heading: 'These are new:',
      lines: fresh.map((gap) => `  ${gap}`),
      epilogue:
        '\nThe surfaces differ in drawing, not in what the game asks or gives. Four passes\n' +
        'running found one of these by reading, one at a time.',
    },
  ],
});
