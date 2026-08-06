#!/usr/bin/env node
/**
 * One bound, declared once.
 *
 * Four bounds in this repository had been written down twice, and one of them
 * three times. They agreed, every one of them, on the day they were copied —
 * which is exactly why nothing had gone wrong yet and exactly why it would.
 * A number that means "the most a report may be" cannot be two numbers, and
 * when it becomes two the app accepts something the file refuses and neither
 * of them says a word about it.
 *
 * The copies are not carelessness. Each was made by somebody who needed the
 * number in a module that could not easily reach the one that had it, and one
 * of them was written directly beneath a comment noting that the other existed.
 * So this is a check rather than a rule to remember.
 *
 * Run:  node scripts/audit-doubles.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declarationsIn, doubled, functionsIn, repeated } from './lib/doubles.mjs';
import { workspacePackages } from './lib/claims.mjs';
import { codeIn } from './lib/reachable.mjs';
import { staleAmong } from './lib/records.mjs';
import { finish } from './lib/report.mjs';
import { sourceFilesUnder } from './lib/source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// Found rather than listed. This held nine of the ten and never saw the phone
// app — the sixth hand-kept list here to be wrong by omission, with the rule
// that prevents it one import away. See `workspacePackages`.
const read = {
  exists: (path) => existsSync(join(ROOT, path)),
  entries: (path) => readdirSync(join(ROOT, path)),
  isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
};
const SOURCES = workspacePackages(read).map((workspace) => workspace.src);

/**
 * Names that are one idea per module rather than one idea shared.
 *
 * `STORAGE_KEY` and its relatives are a module saying where *it* keeps things;
 * two modules with a `STORAGE_KEY` are not two answers to one question, they
 * are two questions. The test is whether a caller could sensibly ask "which of
 * these is the real one" — for a key, they could not.
 *
 * **Empty, and kept.** It held `STORAGE_KEY` and `SCHEMA_VERSION` until the day
 * `audit-records` was first taught to read a `new Set(` and could see this list
 * at all. Both turned out to be declared exactly once —
 * `apps/miniapp/src/state.ts` and `packages/journal/src/index.ts` — so the set
 * suppressed nothing whatever, and emptying it changed no line of this report.
 * It was an excuse that had outlived its reason, in the file that exists to
 * find copies, in the one place no check was looking.
 *
 * Kept rather than deleted because the rule above is still the right rule and
 * the next `STORAGE_KEY` will want it; and because the staleness question below
 * now holds whatever is written here to describing something. A list is only
 * safe to keep once something asks it a question.
 */
const PER_MODULE = new Set([]);

/**
 * Copies that cannot be removed, each with the test that holds it in step.
 *
 * `@leela/journal` declares the board size again because it has no dependencies
 * at all — deliberately, so a browser bundle and a Bun process can both hold it
 * and nothing it imports is imported into both. The copy is the price of that.
 * What is not acceptable is paying it quietly, so the entry names the test that
 * asks the engine what the board is and asks the format what it will accept.
 *
 * An entry here is a promise that something else is watching. Adding one
 * without the test it names is how this list becomes a way of turning the
 * check off.
 *
 * **And for the length of this file's existence, nothing read the promise.**
 * `staleAmong` is handed the KEYS, so the question asked of `TIED` was the same
 * question asked of `PER_MODULE`: does anything still declare this name twice.
 * The VALUE — the whole content of the promise, the file that is supposed to be
 * watching — was read exactly twice, both times to print it: once into
 * *`TOTAL_PLANS` is declared twice on purpose, and `...` holds them in step*,
 * and once into the parenthetical on a copy that disagrees. Measured: delete
 * `packages/journal/tests/board-size.test.ts` and this script still prints that
 * sentence and still exits 0. A name is not a reader.
 *
 * So `unwatched` below asks the two things the paragraph above promises, and
 * `apps/mobile/tests/source.test.ts` is where the pattern is already written
 * correctly — *names one file each, and only files that exist*, then *excuses
 * each of them on a ground it can be seen to have*. The ground here is that the
 * named file mentions the name it is tied to; a file that never says
 * `TOTAL_PLANS` is not holding `TOTAL_PLANS` in step with anything.
 *
 * **Left as `kind: 'record'` in `lib/records.mjs`, deliberately.** The obvious
 * move is to reclassify it as a `permission` and let `stalePermissions` do this,
 * since that machinery already reads a list's entries and asks whether a named
 * place still names them. It does not fit, for two reasons that are about the
 * data rather than about taste. A permission's `namesIn` is one place shared by
 * the whole list and its ENTRIES are the names looked for; `TIED` is the other
 * way round — each entry carries its OWN place, and the thing to look for is the
 * entry's key. And `staleAmong` over the keys is still a live and correct
 * question: an entry naming a constant nothing declares twice is a licence
 * sitting open, which is what `records.mjs` declares this list as asking, and
 * `unwatched` does not replace it. Both questions are asked, and the declaration
 * in `records.mjs` stays true of the one it names.
 */
const TIED = new Map([['TOTAL_PLANS', 'packages/journal/tests/board-size.test.ts']]);

/**
 * Whether a place still names something, as a word in code rather than a substring.
 *
 * The same rule `lib/records.mjs` applies to a permission's entries, and for the
 * same measured reason: comments are cut out first because a file talking about
 * `TOTAL_PLANS` — an entry in this very list is a sentence about it — is not a
 * file reading `TOTAL_PLANS`, and the boundary refuses a letter on either side
 * so `TOTAL_PLANS` is not answered by `TOTAL_PLANS_LEGACY`.
 *
 * Written here rather than imported because `namedIn` is private to that module,
 * and `codeIn` — the half that actually carries the lesson — is imported from
 * `lib/reachable.mjs`, which is where both callers get it.
 */
const namedIn = (source, name) =>
  new RegExp(`(?<![\\w$])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`).test(
    codeIn(source),
  );

/**
 * Entries whose named watcher is not there, or is not watching.
 *
 * Two failures, said apart, because they are two different pieces of work. A
 * missing file is a test somebody deleted or moved and an entry nobody updated;
 * a file that never mentions the name is a test that was rewritten around the
 * thing it was keeping in step. Reported by `finish` as a failing section, so it
 * reaches the exit code — the whole defect here was a promise that printed.
 */
const broken = [...TIED.entries()].flatMap(([name, watcher]) => {
  const path = join(ROOT, watcher);
  if (!existsSync(path)) return [{ name, why: `${watcher} — the test named here is not there` }];
  return namedIn(readFileSync(path, 'utf8'), name)
    ? []
    : [{ name, why: `${watcher} — is there, and never names ${name}` }];
});

const unwatched = broken.map(({ name, why }) => `${name}  ${why}`);
const unwatchedNames = new Set(broken.map(({ name }) => name));

const declarations = SOURCES.flatMap((source) =>
  sourceFilesUnder(join(ROOT, source)).flatMap((path) =>
    declarationsIn(readFileSync(path, 'utf8'), relative(ROOT, path)),
  ),
);

const doubles = doubled(declarations);
const doubledNames = doubles.map(({ name }) => name);

const all = doubles.filter(({ name }) => !PER_MODULE.has(name));
const copies = all.filter(({ name, disagreeing }) => disagreeing || !TIED.has(name));

// Said only of an entry whose promise was checked a few lines above. This
// sentence is the one a reader takes away, and printing it over a test that is
// not there is the whole shape of the defect: a name counted as a reader.
for (const { name } of all.filter(({ name }) => TIED.has(name) && !unwatchedNames.has(name))) {
  console.log(`\n${name} is declared twice on purpose, and ${TIED.get(name)} holds them in step.`);
}

// --- the excuses, asked whether they still describe anything -------------------
//
// Both lists above are excuses, and until `audit-records` learned to read a
// `new Set(` there was nothing in this file that ever asked either of them a
// question. That is the exact rot `lib/records.mjs` was written for, and it was
// living inside the check that reads it: `PER_MODULE` named two constants that
// are each declared once, so emptying it changed no line of this report.
//
// An entry naming a name nothing declares twice is not suppressing a copy. It
// is a licence sitting open for whoever declares that name twice next.

const withdrawn = [
  ...staleAmong([...PER_MODULE], doubledNames).map((name) => `PER_MODULE  ${name}`),
  ...staleAmong([...TIED.keys()], doubledNames).map((name) => `TIED  ${name}`),
];

console.log(`\nChecked ${declarations.length} declared constants across ${SOURCES.length} sources.\n`);

// --- the same function, under whatever name -----------------------------------
//
// Names are the wrong question for a body. Nobody writes eighty identical
// characters of logic by coincidence, and the copy is usually made under a
// different name — which is what kept `within` and `directionFromStatus`
// invisible to everything here until somebody went looking by hand.

const functions = SOURCES.flatMap((source) =>
  sourceFilesUnder(join(ROOT, source)).flatMap((path) =>
    functionsIn(readFileSync(path, 'utf8'), relative(ROOT, path)),
  ),
);

const written = repeated(functions);

console.log(`\nChecked ${functions.length} functions across ${SOURCES.length} sources.\n`);

// The three findings and the sentence that closes the run, arranged by
// `lib/report.mjs` rather than by the order they were written in.
//
// This file is the most reachable instance of the defect that module exists
// for. Its closing sentence asked `written.length === 0` — nothing about
// copies, nothing about withdrawn excuses — so the ordinary case this whole
// script is here to catch, one constant newly declared twice, took the
// `copies.length > 0` branch, set the exit code, printed the two files that
// disagree, and then closed on *every one of them is written once, so a change
// to it reaches everywhere it is*. True of the function bodies, which nobody
// had asked about, and read by a person as the verdict of the run.
//
// `Every bound is declared once...` stays a note rather than an all-clear: it
// is a true statement about the constants half whenever that half is clean, and
// it is only the LAST line that has to belong to whatever failed.
process.exitCode = finish({
  allClear: 'Every one of them is written once, so a change to it reaches everywhere it is.',
  sections: [
    {
      failing: false,
      lines:
        copies.length === 0
          ? ['Every bound is declared once, so there is nothing for a change to leave behind.']
          : [],
    },
    {
      failing: true,
      heading: '\nThese copies were excused on a promise nobody is keeping:\n',
      lines: unwatched.map((line) => `  ${line}`),
      epilogue:
        '\nAn entry in TIED says a named test holds the two declarations in step. Naming\n' +
        'it is not the same as it being there — and this script printed that promise as\n' +
        'a fact for as long as the list existed, without once opening the file.',
    },
    {
      failing: true,
      heading: '\nThese excuses no longer excuse anything:\n',
      lines: withdrawn.map((line) => `  ${line}`),
      epilogue:
        '\nEach names a constant nothing declares twice. Take it out — an excuse kept\n' +
        'past its reason is a licence issued to whoever writes the copy next.',
    },
    {
      failing: true,
      lines: copies.flatMap(({ name, where, disagreeing }) => [
        `  ${name}${disagreeing ? '  — and they do not even agree' : ''}${
          TIED.has(name) ? '  (and the test that was to hold them has not)' : ''
        }`,
        ...where.map((one) => `      ${one.value}   ${one.file}`),
      ]),
      epilogue:
        '\nCopies agree on the day they are made. Nothing goes wrong until one of them is\n' +
        'changed, and then two modules mean different things by one name.',
    },
    {
      failing: true,
      lines: written.flatMap(({ names, where, renamed }) => [
        `  ${names.join(' / ')}${renamed ? '  — the same body under two names' : ''}`,
        ...where.map((one) => `      ${one.name.padEnd(24)} ${one.file}`),
      ]),
      epilogue:
        '\nA function copied is a decision copied. Move it to something both can import,\n' +
        'or delete the one nobody calls — a private copy is invisible to audit-unread.',
    },
  ],
});
