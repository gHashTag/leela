#!/usr/bin/env node
/**
 * Every dependency a caller supplies, against a test that breaks it on purpose.
 *
 * Four passes running found one defect each and all four were the same one: a
 * model that never returned, a download that never returned, a room that would
 * not save, an account that would not record. Each is behaviour the type allows
 * and the code assumed away. Each was found by going looking.
 *
 * The rule this makes checkable: **an injected dependency is a promise the type
 * does not hold anyone to, so something has to break it deliberately.** A test
 * that only ever hands in a working implementation proves the happy path twice.
 *
 * A hostile test is recognised by what it does, not by its name: it builds an
 * implementation that throws, or one that returns a promise nobody settles.
 * That second kind is the one an error path cannot catch, and it is why three
 * of the four defects were invisible to every `catch` around them.
 *
 * Run:  node scripts/audit-promises.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectionPoints, brokenSomewhere } from './lib/promises.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** Where dependencies are declared, and where their tests live. */
const PACKAGES = [
  { src: 'apps/bot/src', tests: 'apps/bot/tests' },
  { src: 'apps/miniapp/src', tests: 'apps/miniapp/tests' },
  { src: 'packages/ai/src', tests: 'packages/ai/tests' },
  { src: 'packages/db/src', tests: 'packages/db/tests' },
  { src: 'packages/journal/src', tests: 'packages/journal/tests' },
];

/**
 * Members nothing can usefully break.
 *
 * `id` is a string on an interface that happens to hold methods, and a string
 * that misbehaves is a string with the wrong value — a different question, and
 * one the prompt tests already ask.
 */
const DATA = new Set(['id', 'apiKey', 'model', 'baseUrl', 'referer', 'title']);

/**
 * Points where a broken implementation is somebody else's to report.
 *
 * `onActivate` is a DOM click listener. An exception inside one does not stop
 * the page, does not corrupt anything, and surfaces as a `window` error — which
 * the mini app's assembled tests already assert is empty on every load. There
 * is nothing here to swallow and therefore nothing to catch swallowing.
 */
const NOT_OURS = new Set(['CellOptions.onActivate']);

/** A test is hostile when it hands something in that throws, or never settles. */
const THROWS = /throw new |Promise\.reject|=> \{\s*throw|rejects\.toThrow/;
const NEVER_SETTLES = /new Promise<[^>]*>\(\(\) => \{\}\)|new Promise\(\(\) => \{\}\)/;

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
    else if (entry.endsWith('.ts') || entry.endsWith('.mts')) found.push(path);
  }

  return found;
}

const unbroken = [];
let checked = 0;
let hostileFiles = 0;

for (const { src, tests } of PACKAGES) {
  const testFiles = filesUnder(join(ROOT, tests)).map((path) => {
    const source = readFileSync(path, 'utf8');
    return { path, source, hostile: THROWS.test(source) || NEVER_SETTLES.test(source) };
  });
  hostileFiles += testFiles.filter((test) => test.hostile).length;

  for (const path of filesUnder(join(ROOT, src))) {
    const source = readFileSync(path, 'utf8');

    for (const point of injectionPoints(source, relative(ROOT, path))) {
      if (DATA.has(point.property)) continue;
      if (NOT_OURS.has(`${point.owner}.${point.property}`)) continue;
      checked += 1;
      if (!brokenSomewhere(point, testFiles, [THROWS, NEVER_SETTLES])) unbroken.push(point);
    }
  }
}

console.log(
  `\nChecked ${checked} injected dependencies against ${hostileFiles} test files that break one.\n`,
);

if (unbroken.length === 0) {
  console.log('Every dependency a caller supplies is handed a broken one somewhere.');
} else {
  for (const point of unbroken) {
    console.log(`  ${point.owner}.${point.property}  (${point.file})`);
  }
  console.log(
    '\nNothing tries these with an implementation that throws or never returns, which is',
  );
  console.log('what four consecutive passes found in the ones that were tried.');
  process.exitCode = 1;
}
