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
import { declarationsIn, doubled } from './lib/doubles.mjs';
import { workspacePackages } from './lib/claims.mjs';

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
 */
const PER_MODULE = new Set(['STORAGE_KEY', 'SCHEMA_VERSION']);

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
 */
const TIED = new Map([['TOTAL_PLANS', 'packages/journal/tests/board-size.test.ts']]);

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
    else if (entry.endsWith('.ts')) found.push(path);
  }

  return found;
}

const declarations = SOURCES.flatMap((source) =>
  filesUnder(join(ROOT, source)).flatMap((path) =>
    declarationsIn(readFileSync(path, 'utf8'), relative(ROOT, path)),
  ),
);

const all = doubled(declarations).filter(({ name }) => !PER_MODULE.has(name));
const copies = all.filter(({ name, disagreeing }) => disagreeing || !TIED.has(name));

for (const { name } of all.filter(({ name }) => TIED.has(name))) {
  console.log(`\n${name} is declared twice on purpose, and ${TIED.get(name)} holds them in step.`);
}

console.log(`\nChecked ${declarations.length} declared constants across ${SOURCES.length} sources.\n`);

if (copies.length === 0) {
  console.log('Every bound is declared once, so there is nothing for a change to leave behind.');
} else {
  for (const { name, where, disagreeing } of copies) {
    console.log(
      `  ${name}${disagreeing ? '  — and they do not even agree' : ''}${
        TIED.has(name) ? '  (and the test that was to hold them has not)' : ''
      }`,
    );
    for (const one of where) console.log(`      ${one.value}   ${one.file}`);
  }
  console.log(
    '\nCopies agree on the day they are made. Nothing goes wrong until one of them is',
  );
  console.log('changed, and then two modules mean different things by one name.');
  process.exitCode = 1;
}
