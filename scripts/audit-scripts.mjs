#!/usr/bin/env node
/**
 * Every script can be started by the runtime it names.
 *
 * `scripts/audit-copies.mjs` is the check that walks the source repositories
 * and reads every copy of the board — the one that found a hundred-square
 * Snakes and Ladders set pretending to be Leela. README says to run it with
 * `node`. Under `node` it dies in the module loader, and has for some time,
 * because it imports the engine's TypeScript and the engine imports `./board`
 * without an extension.
 *
 * Nothing caught it: the script needs the donor clones, so it is not in CI, and
 * a check nobody can run reads exactly like a check that passes.
 *
 * Static rather than a smoke test. Running these has side effects —
 * `board-overlay.mjs` writes a file named after its argument, `build-content.mjs`
 * rebuilds 22 languages — and a test with side effects is one people turn off.
 *
 * Run:  node scripts/audit-scripts.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  auditsRunByCi,
  checkAuditsRun,
  checkRuntimes,
  documentedRuntimes,
  findNodeBlockers,
  needsOf,
  runtimeOf,
} from './lib/runnable.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Read a file, or null — the walk treats "not there" as nothing to follow. */
const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const declared = new Map();
const audits = new Map();

for (const name of readdirSync(join(ROOT, 'scripts')).sort()) {
  if (!name.endsWith('.mjs')) continue;

  const path = `scripts/${name}`;
  const text = read(join(ROOT, path)) ?? '';

  // An audit that exists and is never run is the same defect one step along.
  if (name.startsWith('audit-')) audits.set(path, needsOf(text));

  declared.set(path, {
    runtime: runtimeOf(text),
    blockers: findNodeBlockers(join(ROOT, path), read).map((blocker) => ({
      file: blocker.file.replace(ROOT, ''),
      specifier: blocker.specifier,
    })),
  });
}

// Every place a reader is told to run one of them. Kept as a list of documents
// rather than a list of commands: a command in a document nobody checks is how
// README came to name `node` for a script that cannot use it.
/**
 * A mutation run that was stopped, still in the tree.
 *
 * `audit-mutants` edits shipped source on purpose and leaves a note on disk so
 * the next run of *that script* can put it back — a signal handler cannot,
 * because the process lives inside a synchronous child and dies where it
 * stands. That works, and it waits for a run that may not come for days.
 *
 * It happened twice. The second time a timeout left `return [...chapters];` at
 * the top of `bookFrom`, two book tests went red, and the reason had nothing to
 * do with the code. Anybody reading that would debug the borrowing rule.
 *
 * This runs in CI on every push, so the note is loud within minutes rather than
 * on the next mutation sweep. Recovery stays where it is: `bun
 * scripts/audit-mutants.mjs` reads the note before it reads anything else.
 */
const UNDO_NOTE = join(ROOT, 'scripts', '.mutants-undo.json');

if (existsSync(UNDO_NOTE)) {
  const note = JSON.parse(readFileSync(UNDO_NOTE, 'utf8'));
  console.log(`\nA stopped mutation run left a file broken on purpose:\n\n  ${note.path}\n`);
  console.log(
    'Every other check is now failing for a reason that has nothing to do with\n' +
      'the code. Put it back with: bun scripts/audit-mutants.mjs\n',
  );
  process.exitCode = 1;
}

const DOCS = ['README.md', 'MIGRATION.md', 'packages/contracts/README.md', 'apps/bot/README.md'];

const documented = new Map();
for (const doc of DOCS) {
  const path = join(ROOT, doc);
  if (!existsSync(path)) continue;

  for (const [script, runtimes] of documentedRuntimes(read(path) ?? '')) {
    const named = documented.get(script) ?? new Set();
    for (const runtime of runtimes) named.add(runtime);
    documented.set(script, named);
  }
}

const problems = checkRuntimes(declared, documented);

const workflow = join(ROOT, '.github/workflows/ci.yml');
if (existsSync(workflow)) {
  problems.push(...checkAuditsRun(audits, auditsRunByCi(read(workflow) ?? '')));
}

console.log(`\nChecked ${declared.size} scripts against the runtime each names, and ${audits.size} audits against CI.\n`);

// `problems` holds what THIS block found. The stale-mutation note above sets
// `process.exitCode` on its own and is not in that list, so a run that found a
// broken file and no runtime problem used to print the all-clear as its last
// line — twenty lines below the alarm, which is where nobody is still looking.
// The exit code was right and the sentence under it was wrong, and a human
// reads the sentence: it is how an hour went into debugging `packages/ai` for
// ten failures a tool had caused and this script had already named.
const failed = problems.length > 0 || process.exitCode === 1;

if (!failed) {
  console.log('Every one of them starts under the runtime it declares, and the docs agree.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  if (problems.length > 0) {
    console.log('\nA check nobody can run reads exactly like a check that passes.');
  }
  process.exitCode = 1;
}

// Last, so it is the line still on screen. The note is the one finding here
// that makes every other check in the repository lie, so it gets the final say
// rather than the first.
if (existsSync(UNDO_NOTE)) {
  const note = JSON.parse(readFileSync(UNDO_NOTE, 'utf8'));
  console.log(
    `\nStill broken on purpose: ${relative(ROOT, note.path)}\n` +
      'Put it back with: bun scripts/audit-mutants.mjs',
  );
}
