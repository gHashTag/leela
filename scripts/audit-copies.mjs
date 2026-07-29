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
import { auditBoard, compareToReference, describeProblems } from '../packages/engine/src/index.ts';

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

/**
 * Pull a board out of a file.
 *
 * Two shapes appear across the repositories: an object literal of `from: to`
 * pairs, named for snakes or arrows; and Solidity's `if (newPlan == from) {
 * newPlan = to; }` chain, which carries no names and has to be split by
 * direction.
 */
function extractBoards(source) {
  const boards = [];

  // `const snakePositions = { 12: 8, 16: 4 }` — with or without types.
  const literal = /(snake|arrow)\w*\s*(?::[^=]*)?=\s*(?:Object\.freeze\()?\{([^}]*)\}/gi;
  for (const match of source.matchAll(literal)) {
    const kind = match[1].toLowerCase();
    const jumps = {};
    for (const pair of match[2].matchAll(/(\d+)\s*:\s*(\d+)/g)) {
      jumps[Number(pair[1])] = Number(pair[2]);
    }
    if (Object.keys(jumps).length > 0) boards.push({ kind, jumps });
  }

  // A `case plan === 12:` / `plan: 8` switch, as the published app writes it.
  const switched = /(?:case|if|else if)\s*\(?\s*(?:newPlan|plan)\s*===?\s*(\d+)[^\n]*\n[^\n]*?\bplan:\s*(\d+)/g;
  const cases = { snake: {}, arrow: {} };
  let sawCase = false;
  for (const match of source.matchAll(switched)) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (from === to) continue;
    cases[to < from ? 'snake' : 'arrow'][from] = to;
    sawCase = true;
  }
  if (sawCase) {
    boards.push({ kind: 'snake', jumps: cases.snake });
    boards.push({ kind: 'arrow', jumps: cases.arrow });
  }

  // `else if (newPlan === 12) return handleToMove('snakes', p, newPlan, 8, roll)`
  // — the web3 hook, where the destination is an argument rather than an
  // assignment.
  const called =
    /(?:newPlan|plan)\s*===?\s*(\d+)\s*\)[^\n]*\n?[^\n]*?handleToMove\(\s*'(snakes|arrows)'[^,]*,[^,]*,[^,]*,\s*(\d+)/g;
  const viaCall = { snake: {}, arrow: {} };
  let sawCall = false;
  for (const match of source.matchAll(called)) {
    const from = Number(match[1]);
    const kind = match[2] === 'snakes' ? 'snake' : 'arrow';
    viaCall[kind][from] = Number(match[3]);
    sawCall = true;
  }
  if (sawCall) {
    boards.push({ kind: 'snake', jumps: viaCall.snake });
    boards.push({ kind: 'arrow', jumps: viaCall.arrow });
  }

  // Solidity, and the same chain written in TypeScript: split by direction.
  const chain = /(?:newPlan|plan)\s*===?\s*(\d+)\s*\)\s*\{?\s*(?:newPlan|plan)\s*=\s*(\d+)\s*;/g;
  const solidity = { snake: {}, arrow: {} };
  let found = false;
  for (const match of source.matchAll(chain)) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    solidity[to < from ? 'snake' : 'arrow'][from] = to;
    found = true;
  }
  if (found) {
    boards.push({ kind: 'snake', jumps: solidity.snake });
    boards.push({ kind: 'arrow', jumps: solidity.arrow });
  }

  return boards;
}

/** Merge the boards found in one file into a single snakes/arrows pair. */
function combine(boards) {
  const snakes = {};
  const arrows = {};
  for (const board of boards) {
    Object.assign(board.kind === 'snake' ? snakes : arrows, board.jumps);
  }
  return { snakes, arrows };
}

if (!existsSync(SRC)) {
  console.error(`No source directory at ${SRC}. Clone the repositories, or pass --src.`);
  process.exit(1);
}

const results = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const boards = extractBoards(source);
  if (boards.length === 0) continue;

  const { snakes, arrows } = combine(boards);
  const total = Object.keys(snakes).length + Object.keys(arrows).length;
  // A stray pair or two is a coincidence, not a board.
  if (total < 5) continue;

  results.push({
    file: relative(SRC, file),
    jumps: total,
    problems: auditBoard(snakes, arrows),
    differences: compareToReference(snakes, arrows),
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
  // Three of the twenty jumps, present in any real copy.
  const hints = [/\b12\b[\s\S]{0,40}\b8\b/, /\b54\b[\s\S]{0,40}\b68\b/, /\b17\b[\s\S]{0,40}\b69\b/];
  if (hints.filter((hint) => hint.test(source)).length >= 2) unparsed.push(relativePath);
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

if (unparsed.length > 0) {
  console.log(`\n${unparsed.length} file(s) look like a board but could not be read:`);
  for (const file of unparsed) console.log(`  ${file}`);
  console.log('Check these by hand, or teach extractBoards their shape.');
}
process.exit(wrong > 0 ? 1 : 0);
