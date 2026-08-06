import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * A build that refuses while a mutation run is unfinished — first, and whatever
 * else is wrong.
 *
 * On 2026-08-06 an `audit-mutants` run was killed by a ten-minute timeout and
 * left `return '';` at the top of `summariseReturns` in
 * `packages/ai/src/prompts.ts`. Ten tests in a package nobody had touched went
 * red, and an hour went into looking for a bug in code that was correct. The
 * note that would have explained it was on disk the whole time, in
 * `scripts/.mutants-undo.json`; nothing on the path anybody walks read it.
 * `bun run verify` is `content:build && typecheck && typecheck:strict && test`,
 * and only the *next* `audit-mutants` run restores. So `content:build`, the
 * first thing `verify` executes, now reads the note and stops.
 *
 * **What this file asserts is the ORDER, structurally.** The build has another
 * refusal in it — the regression guard, which stops a rebuild that found less
 * than the dataset already has — and that one has a `--force` escape hatch and
 * fires on a bad `--src`. Over a grid of argv rows chosen so that the *other*
 * things the build can object to are present and absent in every combination,
 * the answer must always be the same one: the mutation. A run whose argv is
 * fine and a run whose argv is hopeless get the same first sentence, because
 * an unfinished mutation is not a judgement call about the dataset and
 * `--force` is not for it.
 *
 * The note used here is always a temporary one handed over with
 * `--mutation-note`. Nothing writes to `scripts/.mutants-undo.json`, and
 * `--src` never points at `packages/content/data`.
 *
 * A HAZARD, stated because a reader of a failure needs it: the build writes to
 * `packages/content/data`, a path no flag can move. If the guard ever fails
 * open, the `--force` row here will let an empty `--src` overwrite the shipped
 * dataset — that is the original accident, reproduced. The last assertion in
 * each row is that nothing was written, so the failure names itself; recover
 * with `node scripts/build-content.mjs`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const BUILD = join(REPO, 'scripts', 'build-content.mjs');
const DATA = join(REPO, 'packages', 'content', 'data');

/** The donor repositories, when this machine has them. */
const DONOR = join(REPO, '..', 'leela-src');

const room = mkdtempSync(join(tmpdir(), 'leela-refuses-'));
afterAll(() => rmSync(room, { recursive: true, force: true }));

const EMPTY = mkdtempSync(join(room, 'nothing-'));

const note = join(room, 'note.json');
writeFileSync(note, JSON.stringify({ path: join(REPO, 'packages/ai/src/prompts.ts'), original: '' }));

/** Everything in the generated dataset, as bytes, so "it wrote" is answerable. */
const snapshot = () =>
  Object.fromEntries(
    readdirSync(DATA)
      .filter((name) => name.endsWith('.json'))
      .map((name) => [name, readFileSync(join(DATA, name), 'utf8')]),
  );

/**
 * The argv rows.
 *
 * `--src` at a real donor tree is the run that would otherwise succeed; at an
 * empty directory it is the run the regression guard exists to stop. `--force`
 * turns that guard off. Neither axis may change the answer.
 */
const sources: Array<[string, string]> = [
  [existsSync(DONOR) ? 'a real donor tree' : 'the donor tree, absent on this machine', DONOR],
  ['an empty directory', EMPTY],
];
const forced: Array<[string, string[]]> = [
  ['without --force', []],
  ['with --force', ['--force']],
];

describe('a build asked to run while a mutation is still in a shipped file', () => {
  for (const [why, src] of sources) {
    for (const [how, force] of forced) {
      it(`refuses, and says the mutation rather than the dataset — ${why}, ${how}`, () => {
        const before = snapshot();

        const run = spawnSync(
          process.execPath,
          [BUILD, '--src', src, '--mutation-note', note, ...force],
          { cwd: REPO, encoding: 'utf8' },
        );

        const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;

        expect(run.status, said).not.toBe(0);

        // The reason, not merely a refusal: the file that is broken and the one
        // command that undoes it.
        expect(said).toContain('packages/ai/src/prompts.ts');
        expect(said).toContain('bun scripts/audit-mutants.mjs');

        // And not the other refusal. This is the ordering assertion: move the
        // mutation check below the regression guard and the empty-directory row
        // starts answering with this sentence instead.
        expect(said).not.toContain('found less than the dataset already has');

        // Nothing was written. See the hazard note at the top of this file.
        expect(snapshot()).toEqual(before);
      });
    }
  }

  it('writes its note somewhere disposable, never where the real one lives', () => {
    // A note left at `scripts/.mutants-undo.json` by a test would block every
    // later build on this machine — including the one that recovers from it.
    // Asserted about this file's own choice rather than about the machine: a
    // check that fails when somebody genuinely has a stopped mutation would be
    // crying wolf at the one moment the guard is right.
    expect(note).not.toBe(join(REPO, 'scripts', '.mutants-undo.json'));
    expect(note.startsWith(tmpdir()) || note.startsWith(`/private${tmpdir()}`)).toBe(true);
    expect(EMPTY).not.toBe(DATA);
  });
});
