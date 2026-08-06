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
 */
export const RECOVERY = 'bun scripts/audit-mutants.mjs --restore';

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
