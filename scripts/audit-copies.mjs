#!/usr/bin/env node
/**
 * Find every copy of the board across the source repositories, and check it.
 *
 * The rules were copied ten times over 25 repositories. One of those copies —
 * `NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` — turned out to be a
 * 100-square Snakes and Ladders set rather than Leela, and nothing caught it
 * because nothing looked. This looks.
 *
 * Run:  node scripts/audit-copies.mjs [--src ../leela-src]
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditBoard,
  compareToReference,
  declaresBoard,
  describeProblems,
  detectRules,
  extractBoards,
} from '../packages/engine/src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : join(HERE, '..', '..', 'leela-src');

const SKIP = new Set(['node_modules', '.git', 'build', 'generated', 'dist', 'ios', 'android']);
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.sol'];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);

    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }

    if (stats.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}


if (!existsSync(SRC)) {
  console.error(`No source directory at ${SRC}. Clone the repositories, or pass --src.`);
  process.exit(1);
}

const results = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const { snakes, arrows, count } = extractBoards(source);
  // A stray pair or two is a coincidence, not a board.
  if (count < 5) continue;
  const total = count;

  results.push({
    file: relative(SRC, file),
    jumps: total,
    problems: auditBoard(snakes, arrows),
    differences: compareToReference(snakes, arrows),
    rules: detectRules(source),
  });
}

results.sort((a, b) => a.file.localeCompare(b.file));

/**
 * Files that mention the board but yielded too few jumps to check.
 *
 * Reported rather than ignored: a scanner that quietly skips what it cannot
 * read is worse than no scanner, because it reads as coverage.
 */
const unparsed = [];
for (const file of walk(SRC)) {
  const relativePath = relative(SRC, file);
  if (results.some((r) => r.file === relativePath)) continue;

  const source = readFileSync(file, 'utf8');
  // Only files that actually declare a board: a test asserting about one
  // mentions every square and carries none, and reporting it would be noise.
  if (declaresBoard(source)) unparsed.push(relativePath);
}

console.log(`Found ${results.length} copies of the board under ${SRC}\n`);

let wrong = 0;
for (const result of results) {
  const agrees = result.differences.length === 0 && result.problems.length === 0;
  if (!agrees) wrong++;

  console.log(`${agrees ? 'ok  ' : 'DIFF'}  ${result.file}  (${result.jumps} jumps)`);
  if (!agrees) {
    console.log(`      ${describeProblems(result.problems).split('\n').join('\n      ')}`);
    if (result.differences.length > 0) {
      console.log(`      ${result.differences.length} differences from the engine`);
    }
  }
}

console.log(
  `\n${results.length - wrong} of ${results.length} copies agree with @leela/engine.`,
);

// The boards mostly agree; the rules do not. Print them side by side, because
// a copy with the right board and no three-sixes rule is a different game
// wearing the same map.
const RULE_LABELS = {
  entryOnSix: 'entry on 6',
  threeSixesReset: '3 sixes',
  refusesOvershoot: 'no overshoot',
  winsOnExactLanding: 'win on 68',
  reportGate: 'report gate',
  rerollOnRepeat: 'reroll',
};

console.log('\nRules each copy carries:\n');
const keys = Object.keys(RULE_LABELS);
console.log(`${''.padEnd(52)}${keys.map((k) => RULE_LABELS[k].padEnd(14)).join('')}`);
for (const result of results) {
  const name = result.file.length > 50 ? `…${result.file.slice(-49)}` : result.file;
  const marks = keys.map((key) => (result.rules[key] ? 'yes' : '—').padEnd(14)).join('');
  console.log(`${name.padEnd(52)}${marks}`);
}

if (unparsed.length > 0) {
  console.log(`\n${unparsed.length} file(s) look like a board but could not be read:`);
  for (const file of unparsed) console.log(`  ${file}`);
  console.log('Check these by hand, or teach extractBoards their shape.');
}
process.exit(wrong > 0 ? 1 : 0);
