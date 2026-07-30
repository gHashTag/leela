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
import { join } from 'node:path';
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

if (problems.length === 0) {
  console.log('Every one of them starts under the runtime it declares, and the docs agree.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('\nA check nobody can run reads exactly like a check that passes.');
  process.exitCode = 1;
}
