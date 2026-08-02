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
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/** Say what is about to be broken, and how to undo it. */
export function remember(notePath, filePath, original) {
  writeFileSync(notePath, JSON.stringify({ path: filePath, original }));
}

/**
 * Put back whatever the note describes, and forget it.
 *
 * @returns The file that was restored, or null when there was nothing to do.
 */
export function putItBack(notePath) {
  if (!existsSync(notePath)) return null;

  const note = JSON.parse(readFileSync(notePath, 'utf8'));
  writeFileSync(note.path, note.original);
  rmSync(notePath);

  return note.path;
}
