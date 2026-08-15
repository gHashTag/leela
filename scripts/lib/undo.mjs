/**
 * Putting back a file a script broke on purpose.
 *
 * `audit-mutants` edits the repository's own source — that is what it is for —
 * and a run that is stopped mid-mutation leaves the edit behind. It happened:
 * a timeout killed it and `return { kind: 'chat' };` stayed at the top of
 * `destinationFor` in a shipped file. Seven tests failed afterwards for a
 * reason that had nothing to do with the code, and a commit made without
 * running them would have shipped it.
 *
 * **A signal handler is not enough, and that was measured rather than assumed.**
 * The first fix restored on `SIGINT`, `SIGTERM` and `exit`, and a kill mid-run
 * still left the mutation in the file: a script like this spends its whole life
 * inside `execFileSync`, a synchronous child, so the event loop never turns and
 * the handler never runs. The process dies where it stands.
 *
 * A note on disk survives that, and a `SIGKILL`, and the machine losing power.
 * The next run reads it before it reads anything else — which matters, because
 * the file it is about to copy *is* the mutated one.
 *
 * **The note now blocks a build as well as guiding the next mutation run.**
 * Restoring at the start of the *next* `audit-mutants` run only helps somebody
 * who runs `audit-mutants` next, and nobody does: the command this repository
 * hands people is `bun run verify`, which is
 * `content:build && typecheck && typecheck:strict && test` and reads no audit
 * and no note. On 2026-08-06 a stopped run left `return '';` at the top of
 * `summariseReturns` in `packages/ai/src/prompts.ts`; ten tests went red and an
 * hour went into a package nobody had touched. So `pendingMutation` below is
 * read by `build-content.mjs`, which `verify` runs first, and the note turns
 * that hour into one printed sentence.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/** Say what is about to be broken, and how to undo it. */
export function remember(notePath, filePath, original) {
  writeFileSync(notePath, JSON.stringify({ path: filePath, original }));
}

/**
 * What puts the file back. Stated once, so a message cannot drift from it.
 *
 * Exported, and that is the point rather than tidiness. The sentence *put it
 * back with …* was hand-typed in three places — here, and twice in
 * `audit-scripts.mjs` — three copies of one command agreeing by luck, in the
 * repository whose whole habit is that a restated list is a list that drifts.
 * Every message about a stopped mutation now reads this constant, so changing
 * the command changes every message.
 *
 * It names `--restore` deliberately. The command used to be the bare sweep, and
 * the sweep restores first and then starts breaking files again for several
 * minutes: somebody who read *put it back with `bun scripts/audit-mutants.mjs`*
 * and stopped it once the restore line printed was left with a NEW mutation in
 * a DIFFERENT file. The recovery a message prints has to be a recovery and
 * nothing else.
 *
 * **It named `bun` for a script whose shebang says node, and the runtime audit
 * could not see it.** The point is not that `bun` fails. MEASURED on
 * 2026-08-06: both runtimes execute `scripts/audit-mutants.mjs` today, and
 * `--restore` is read before any decision is, so under either one the command
 * puts the file back and exits — that was checked by running it. The point is
 * that this is `audit-scripts.mjs`'s entire subject. Its recorded finding is
 * `bun scripts/board-overlay.mjs` written in `CLAUDE.md` for a node-shebang
 * script, and `checkRuntimes` calls a documented runtime that differs from the
 * shebang a problem in both directions — because a command kept by hand goes
 * stale both ways, and because the day this script grows a Node-only import is
 * the day the sentence a broken tree prints stops working, with nothing having
 * changed here.
 *
 * That audit built its list from markdown alone, and MEASURED the same day: no
 * markdown in this repository names `audit-mutants.mjs` with a runtime at all.
 * So the most consequential command in the repository — the one printed by
 * three separate programs at the moment shipped source is wrong on disk — was
 * outside the check by construction, and was spelled the one way the check
 * exists to forbid. The doc-comment above argues for one constant so that
 * changing the command changes every message; the constant it centralised was
 * the one nothing checked. `audit-scripts.mjs` now feeds this string through
 * `documentedRuntimes` beside the documents, and
 * `packages/content/tests/undo.test.ts` holds every exported command in
 * `scripts/lib` to its script's shebang.
 *
 * Falsified rather than assumed. Putting `bun` back here, on 2026-08-06, gave
 * `node scripts/audit-scripts.mjs` exit 1 and the line
 * ``scripts/audit-mutants.mjs: documented as `bun scripts/audit-mutants.mjs`,
 * but it declares node``, and gave the guard in that test file
 * `expected 'bun' to be 'node' // Object.is equality` under
 * *scripts/lib/undo.mjs exports RECOVERY*. Both were observed failing before
 * `node` went back in.
 */
export const RECOVERY = 'node scripts/audit-mutants.mjs --restore';

/**
 * What puts the file back when the note cannot say which file it is.
 *
 * Not the same command, because the same command would read the same
 * unreadable note and be no further on. What is left is what git knows: the
 * mutated file is tracked shipped source, so it is sitting in the working tree
 * as an uncommitted change beside whatever the developer is actually doing.
 * `git status` names it and `git restore` undoes it. That is a recovery a
 * person can perform without this tool's help, which is the property that
 * matters when this tool is the thing that broke.
 */
export const UNREADABLE_RECOVERY =
  'git status --short  (the mutation is an uncommitted change), then: git restore <that file>';

/** The only two flags `audit-mutants.mjs` has, spelled once so a parser and a message agree. */
export const RESTORE_FLAG = '--restore';
export const NOTE_FLAG = '--mutation-note';

/**
 * The sweep, as a command, derived rather than retyped.
 *
 * {@link RECOVERY} is the restore. Everything else this script does is that
 * command without the flag, so it is written here as a subtraction. A second
 * hand-typed `node scripts/audit-mutants.mjs` in a usage block is exactly the
 * drift the doc-comment on `RECOVERY` above spends a page arguing against, and
 * a usage block is the one place a stale command is read by somebody who has
 * already lost their bearings.
 */
export const SWEEP = RECOVERY.replace(` ${RESTORE_FLAG}`, '');

/**
 * What to print when the arguments were not understood, or somebody asked.
 *
 * Built from {@link RECOVERY} and {@link SWEEP} for the reason those exist: the
 * recovery command has exactly one spelling in this repository, and a usage
 * text is a message like any other.
 */
export function usage() {
  return [
    'Break each decision in the table on purpose, run the suites that own it, and',
    'report the ones nothing noticed. This edits shipped source in place.',
    '',
    'Usage:',
    `  ${SWEEP} <decision>...`,
    '      break only the decisions named. Names must be in the table.',
    `  ${SWEEP}`,
    '      no name at all: every decision, a full test run each, several minutes.',
    `  ${RECOVERY}`,
    '      put back what a stopped run left behind, and break nothing new.',
    `  ${SWEEP} ${NOTE_FLAG} <path>`,
    '      keep the note somewhere other than scripts/.mutants-undo.json.',
    '',
    `There are no other flags. ${RESTORE_FLAG} and ${NOTE_FLAG} are the whole list, so`,
    'anything else is refused rather than ignored: an unrecognised flag used to be',
    'discarded, which left the script looking at an empty list of names, which is',
    'how it is told to break everything.',
  ].join('\n');
}

/**
 * The arguments, as a decision rather than as three expressions in a row.
 *
 * Names are separated from flags by hand rather than by a parser, and the value
 * after `--mutation-note` is dropped explicitly — a path that survived into the
 * names would silently select no decisions, which reads like a clean sweep of
 * nothing.
 *
 * **Discarding what it did not recognise was the defect, and it was the worst
 * shape it could have had.** The line was
 * `args.filter((arg) => !arg.startsWith('--'))`: every unknown flag fell out of
 * the list, an empty list of names means *the operator named no decisions*, and
 * that means **all of them**. So `--help`, `-h`, `--dry-run`, `--list` and a
 * typo'd `--restor` were each, exactly and silently, the bare command — the full
 * destructive sweep, in the script whose stopped runs have twice cost this
 * project an hour, and which the standing operator note tells people to invoke
 * by name. Somebody reaching for `--help` on a tool they do not know is the
 * likeliest first contact anybody has with it, and it was the one input that
 * started breaking shipped source with no output to explain why.
 *
 * The shape of the fix is that the parser is now allowed to say *no*. Three
 * answers, and the caller can act on none of them by accident:
 *
 *  - `{ kind: 'usage' }` — `--help` or `-h`. Print and stop.
 *  - `{ kind: 'refused', unknown }` — any other token that begins with `-`, a
 *    name that is not in the table, or `--mutation-note` with no path after it.
 *    Print the offending tokens and the usage, and **select nothing**.
 *  - `{ kind: 'run', restoreOnly, notePath, names }` — understood in full.
 *
 * `--restore` returns `names: []` whatever names were given, and that is a
 * decision rather than an oversight: the flag exists so that the command a
 * broken tree prints does the restore and nothing else, so it exits before a
 * decision is selected and the names cannot reach anything. `undo.test.ts`
 * drives the restore path with a name that matches nothing on purpose, as proof
 * that the flag is honoured rather than that the name was harmless.
 *
 * @param args argv without the runtime and the script — `process.argv.slice(2)`.
 * @param known every decision name in the caller's table. A name outside it is
 *   refused rather than filtered away, because filtering it away is how an
 *   empty list of names is reached, and an empty list means everything.
 */
export function readArgv(args, known = []) {
  const unknown = [];
  const names = [];
  let restoreOnly = false;
  let notePath = null;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === '--help' || token === '-h') return { kind: 'usage' };

    if (token === RESTORE_FLAG) {
      restoreOnly = true;
      continue;
    }

    if (token === NOTE_FLAG) {
      const value = args[index + 1];
      // A missing path, or a path that is itself flag-shaped, is somebody who
      // meant to type one. Consuming the next flag as a filename would write
      // the note to `--restore` and then look like it had done as it was told.
      if (value === undefined || value.startsWith('-')) {
        unknown.push(token);
        continue;
      }
      notePath = value;
      index += 1;
      continue;
    }

    if (token.startsWith('-')) {
      unknown.push(token);
      continue;
    }

    names.push(token);
  }

  if (unknown.length > 0) return { kind: 'refused', unknown };

  if (restoreOnly) return { kind: 'run', restoreOnly: true, notePath, names: [] };

  const strangers = names.filter((name) => !known.includes(name));
  if (strangers.length > 0) return { kind: 'refused', unknown: strangers };

  return { kind: 'run', restoreOnly: false, notePath, names };
}

/**
 * Put back whatever the note describes, and forget it.
 *
 * **The note may not parse, and this used to die on it.** `JSON.parse` sat here
 * bare while the doc-comment on `pendingMutation` below already said, in so
 * many words, that a note that will not parse is the *likeliest* note — more
 * obviously a killed run than a clean one, since something interrupted the
 * write. It is not a hypothetical: `remember` writes the note with a single
 * non-atomic `writeFileSync`, so a kill mid-write leaves exactly a prefix of
 * the JSON on disk. MEASURED on 2026-08-06: `putItBack` on a note holding the
 * one character `{` threw `SyntaxError`, while `pendingMutation` on the same
 * note correctly answered `{ path: null, recovery: … }`. The two readers of one
 * file disagreed about whether it could be read, and the one that disagreed is
 * the one every message in this repository prints as the way out.
 *
 * So the contract, and each half of it was chosen against a way of being wrong:
 *
 *  - **It does not throw.** Whatever is on disk, the caller gets an answer. A
 *    recovery command that dies on the input that motivates it is worse than no
 *    command, because the person running it now believes the tooling is broken
 *    in some second way.
 *  - **It never deletes or rewrites a note it could not read.** The note holds
 *    the only copy of the original text of a file that is currently wrong on
 *    disk. Removing an unparseable note to tidy up would destroy the evidence
 *    and silence the guard in the same stroke — the tree would look clean to
 *    `build-content` and still hold the mutation.
 *  - **Its answer distinguishes three cases, not two.** There was no note; a
 *    file was put back; a note is there and cannot be read. Collapsing the
 *    third into either of the others is how the silence comes back.
 *
 * A note that parses but is not shaped like a note — `path` a number, `original`
 * missing — is treated as unreadable for the same reason. `writeFileSync(42,
 * undefined)` throws just as loudly as `JSON.parse` did, and a half-written
 * note that happens to land on valid JSON is a real shape: `{"path":null}` is
 * three keystrokes away from a truncated write.
 *
 * @returns null when there was no note at all; otherwise
 *   `{ restored, note, recovery }` — `restored` is the path of the file put
 *   back, or null when the note could not be read, and `recovery` is null on
 *   success and {@link UNREADABLE_RECOVERY} otherwise.
 */
export function putItBack(notePath) {
  if (!existsSync(notePath)) return null;

  const unreadable = { restored: null, note: notePath, recovery: UNREADABLE_RECOVERY };

  let note;
  try {
    note = JSON.parse(readFileSync(notePath, 'utf8'));
  } catch {
    return unreadable;
  }

  if (typeof note?.path !== 'string' || typeof note?.original !== 'string') return unreadable;

  writeFileSync(note.path, note.original);
  rmSync(notePath);

  return { restored: note.path, note: notePath, recovery: null };
}

/**
 * Put the file back for a caller that is still holding the original text.
 *
 * {@link putItBack} is for the *next* process: the one that broke the file is
 * gone, so the note on disk is the only copy. This is for the process that is
 * still running — `audit-mutants`, in the `finally` after each mutation, with
 * `original` sitting in a local variable one line above.
 *
 * **Its two failure arms used to be handled backwards, and the wrong one was
 * silent.** The code read:
 *
 *     if (back === null || back.restored === null) {
 *       console.error(`Could not put ${file} back — stopping before anything
 *                      else is broken.`);
 *       console.error(back === null ? '  The note is gone.' : recovery);
 *       process.exit(1);
 *     }
 *
 * When the note was merely unreadable the operator got a command, and the note
 * itself still held the original text — the recoverable case. When the note was
 * **gone** they got the sentence `The note is gone.`, no command, no write, and
 * an exit — under *stopping before anything else is broken*, which reads as an
 * all-clear at the exact moment the tree holds a mutation in shipped source
 * with nothing on disk pointing at it. And the copy that would have fixed it
 * was in scope, one line above, unused.
 *
 * So: when there is no note, this writes `original` back itself. That is not
 * the same act as the repair `pendingMutation` refuses to perform during a
 * build — there the process has no idea what happened, here the process is the
 * one that did it, to a file it read seconds ago.
 *
 * Every arm either restores the file or hands the caller the text, and the
 * caller can tell which without reading a message:
 *
 *  - `{ kind: 'restored', path }` — the note did it, and is forgotten.
 *  - `{ kind: 'rewritten', path, check }` — no note; this wrote the copy back.
 *    `check` is the command that shows whether the tree is clean again, because
 *    a claim to have repaired something is worth what its check is worth.
 *  - `{ kind: 'unrestored', path, original, recovery, why }` — the file is still
 *    broken. `original` is the text, so nothing is lost even here, and `why` is
 *    the write's own error when there was one.
 */
export function putItBackOrRewrite(notePath, broke) {
  const { path, original } = broke;
  const back = putItBack(notePath);

  if (back !== null && back.restored !== null) return { kind: 'restored', path: back.restored };

  if (back !== null) {
    // The note is there and will not parse. It is deliberately left on disk —
    // it may be the only copy of some *other* file's original text, and this
    // one is carried back to the caller instead.
    return {
      kind: 'unrestored',
      path,
      original,
      recovery: back.recovery,
      why: null,
    };
  }

  try {
    writeFileSync(path, original);
  } catch (error) {
    return {
      kind: 'unrestored',
      path,
      original,
      recovery: UNREADABLE_RECOVERY,
      why: error instanceof Error ? error.message : String(error),
    };
  }

  return { kind: 'rewritten', path, check: `git diff --name-only ${path}` };
}

/**
 * Whether a mutation run is still unfinished, for a caller that only wants to
 * know — and to refuse.
 *
 * This deliberately does *not* restore anything. A build is not the right
 * process to put a shipped source file back: it would be repairing the tree
 * underneath a developer who has not been told anything happened, and the
 * repair would land in the same commit as their work. Saying so and stopping
 * is the whole job.
 *
 * The note's existence is the signal, not its contents. A note that will not
 * parse is still a run that was killed — more obviously one, in fact, since
 * something interrupted the write — so it refuses too, with `path` null
 * because it genuinely does not know which file is broken. Refusing on a
 * corrupt note is the safe direction: the cost is one message, and the cost of
 * the other direction is the hour of 2026-08-06.
 *
 * @returns null when there is no note, otherwise `{ path, recovery }` where
 *   `path` is the shipped file currently holding a mutation (null if the note
 *   cannot be read) and `recovery` is the exact command that puts it back.
 */
export function pendingMutation(notePath) {
  if (!existsSync(notePath)) return null;

  try {
    const note = JSON.parse(readFileSync(notePath, 'utf8'));
    return { path: typeof note?.path === 'string' ? note.path : null, recovery: RECOVERY };
  }
  catch {
    return { path: null, recovery: RECOVERY };
  }
}
