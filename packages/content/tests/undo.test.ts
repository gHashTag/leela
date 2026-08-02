import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { putItBack, remember } from '../../../scripts/lib/undo.mjs';

/**
 * Putting back a file a script broke on purpose.
 *
 * `audit-mutants` edits this repository's own source — that is what it is for —
 * and a run that is stopped mid-mutation leaves the edit behind. It happened:
 * a timeout killed it and `return { kind: 'chat' };` stayed at the top of
 * `destinationFor` in a shipped file. Seven tests failed afterwards for a
 * reason that had nothing to do with the code.
 *
 * A signal handler is not enough, and that was measured rather than assumed:
 * a script like that spends its whole life inside `execFileSync`, so the event
 * loop never turns and the handler never runs. A note on disk survives it, and
 * a `SIGKILL`.
 */

const room = mkdtempSync(join(tmpdir(), 'leela-undo-'));
afterAll(() => rmSync(room, { recursive: true, force: true }));

/** A file with something in it, and the note beside it. */
function broken(name: string, was: string, now: string) {
  const file = join(room, `${name}.ts`);
  const note = join(room, `${name}.json`);

  writeFileSync(file, was);
  remember(note, file, was);
  writeFileSync(file, now);

  return { file, note };
}

describe('a file a script broke on purpose', () => {
  it('comes back exactly as it was', () => {
    const { file, note } = broken('one', 'export const answer = 41;\n', 'export const answer = 0;\n');

    expect(putItBack(note)).toBe(file);
    expect(readFileSync(file, 'utf8')).toBe('export const answer = 41;\n');
  });

  it('is put back by a later run, not by the one that broke it', () => {
    // The whole point: the process that made the mess is gone. Nothing here
    // holds state, so a fresh one reads the note and finishes the job.
    const { file, note } = broken('two', 'a', 'b');

    expect(existsSync(note), 'the note outlives the run').toBe(true);
    putItBack(note);
    expect(readFileSync(file, 'utf8')).toBe('a');
  });

  it('forgets the note once it has used it', () => {
    // A note left behind would put an old file back over a newer one at the
    // next run — a restore that becomes the damage.
    const { note } = broken('three', 'a', 'b');

    putItBack(note);
    expect(existsSync(note)).toBe(false);
  });

  it('says nothing happened when nothing did', () => {
    expect(putItBack(join(room, 'no-such-note.json'))).toBeNull();
  });

  it('carries a file of any shape, not a line of one', () => {
    // The originals are whole source files: braces, quotes, newlines, and
    // whatever a comment in this repository contains.
    const awkward = 'const x = `${"a"}`;\n// «кавычки» and a \\ backslash\n\n\t{}\n';
    const { file, note } = broken('four', awkward, 'gone');

    putItBack(note);
    expect(readFileSync(file, 'utf8')).toBe(awkward);
  });
});
