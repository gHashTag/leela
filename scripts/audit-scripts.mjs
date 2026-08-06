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
import { pendingMutation } from './lib/undo.mjs';

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
 * on the next mutation sweep. Recovery is not restated here: `lib/undo.mjs`
 * exports it, and both messages below print that constant.
 *
 * **It read the note with a bare `JSON.parse` and died on it.** MEASURED on
 * 2026-08-06 against a copy of this script: given a note holding
 * `{"path": "/repo/packages/ai/src/prompts.ts", "orig` — a prefix, which is
 * exactly what a kill mid-write leaves, since `remember` writes the note with
 * one non-atomic `writeFileSync` — this file exited with an uncaught
 * `SyntaxError` at the parse, before the runtime audit had run at all. So in CI
 * the one push that most needed the sentence *a tool did this and not your
 * code* got a stack trace in `audit-scripts.mjs` instead, and lost the runtime
 * check with it. `pendingMutation` already handled that input correctly and was
 * simply not imported here; it is now, and there is one reader of this note in
 * the repository rather than three.
 *
 * `--mutation-note` moves where the note is looked for, never whether it is,
 * the same seam `build-content.mjs` carries and for the same reason: a test
 * that drives this path must not write to `scripts/.mutants-undo.json`, which
 * would block every build on the machine — including the one that recovers.
 */
const noteFlag = process.argv.indexOf('--mutation-note');
const UNDO_NOTE =
  noteFlag > -1 ? process.argv[noteFlag + 1] : join(ROOT, 'scripts', '.mutants-undo.json');

/**
 * Read once, printed twice — at the top where an alarm belongs and at the
 * bottom where a reader is still looking. Reading it once also means the two
 * messages cannot disagree about whether there is a note.
 */
const stopped = pendingMutation(UNDO_NOTE);

/** What a note says is broken, or an admission that it cannot say. */
const brokenFile = (note) =>
  note.path === null
    ? 'unknown — the note itself will not parse, which is a run stopped mid-write'
    : note.path;

if (stopped) {
  console.log(`\nA stopped mutation run left a file broken on purpose:\n\n  ${brokenFile(stopped)}\n`);
  console.log(
    'Every other check is now failing for a reason that has nothing to do with\n' +
      `the code. Put it back with: ${stopped.recovery}\n`,
  );
  process.exitCode = 1;
}

/**
 * Every place a reader is told to run one of them.
 *
 * Kept as a list of documents rather than a list of commands: a command in a
 * document nobody checks is how README came to name `node` for a script that
 * cannot use it.
 *
 * The list held four documents, and the three an agent is told to read *before*
 * anything else were not among them. `CLAUDE.md`, `AGENTS.md` and
 * `.specify/memory/constitution.md` name script commands too, and nothing
 * looked at them: between them they named six commands, all unaudited, while
 * README's eighteen and MIGRATION's one were held to the shebang.
 *
 * One of the six was already wrong. `bun scripts/board-overlay.mjs` in the
 * gates block of `CLAUDE.md`, for a script whose shebang says node — the exact
 * finding MIGRATION.md records as closed, because it was fixed in README and
 * left standing in the file Claude Code opens first. The audit ended on "the
 * docs agree" for a year while the instructions disagreed.
 *
 * `packages/engine/tests/runnable.test.ts` holds this list to the documents
 * that exist, so the next document to name a command is either audited or
 * named as unaudited. Adding a document here is cheap; being outside it is
 * invisible.
 */
const DOCS = [
  'README.md',
  'MIGRATION.md',
  'CLAUDE.md',
  'AGENTS.md',
  '.specify/memory/constitution.md',
  'packages/contracts/README.md',
  'apps/bot/README.md',
];

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
  } else {
    // Scoped to this block on purpose. The unscoped all-clear is suppressed
    // above and stays suppressed — it was the sentence a human read while the
    // exit code said otherwise. But saying nothing at all is the other way to
    // be wrong: this script used to *die* on a corrupt note, so a run that
    // survives one has to show that the runtime audit itself ran and found
    // nothing, or the reader cannot tell it from the crash.
    console.log('  No runtime problem: the failure above is the stopped mutation, not this check.');
  }
  process.exitCode = 1;
}

// Last, so it is the line still on screen. The note is the one finding here
// that makes every other check in the repository lie, so it gets the final say
// rather than the first.
if (stopped) {
  console.log(
    `\nStill broken on purpose: ${stopped.path === null ? brokenFile(stopped) : relative(ROOT, stopped.path)}\n` +
      `Put it back with: ${stopped.recovery}`,
  );
}
