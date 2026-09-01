import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
// The one command the build prints, taken from the constant the build prints it
// from. Typed by `scripts/lib/undo.d.mts`, so no directive is needed.
import { RECOVERY } from '../../../scripts/lib/undo.mjs';

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
 *
 * **The mutation note is no longer the only thing a stopped tool leaves.**
 * Stryker replaced `audit-mutants` for the engine package precisely because it
 * mutates a copy — but it makes that copy at `.stryker-tmp/sandbox-<n>/`, and
 * `cleanTempDir: 'always'` clears it only after a run that finishes. MEASURED
 * on 2026-08-06: two shell commands, `mkdir -p .stryker-tmp/sandbox-VERIFY` and
 * a `cp` of README into it, turned `packages/engine/tests/runnable.test.ts` red
 * — it walks the repository for markdown and read the copy as a document
 * nothing audits. `bun run verify` went red in a package nobody had touched,
 * for a tool that was not running. The same hour, the second time.
 *
 * So the grid rows below no longer assert about one marker. They read every
 * leftover-artifact marker `scripts/build-content.mjs` declares — its
 * `<X>_MARKER` constants, and the `<X>_RECOVERY` beside each — and require a
 * refusal for **all** of them, over the same argv grid, so the answer is the
 * marker whatever else is also wrong. A list derived from the build cannot
 * fall behind the build; a list of the two names somebody remembered is
 * exactly what went stale everywhere else in this repository.
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

/** What the build is, as text. Read, never imported — see `artifactsIn` below. */
const SOURCE = readFileSync(BUILD, 'utf8');

/** Every `.mjs` under `scripts/`, so a constant can be followed across the import. */
const LIBRARY = readdirSync(join(REPO, 'scripts', 'lib'))
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => readFileSync(join(REPO, 'scripts', 'lib', name), 'utf8'));

type Artifact = { name: string; marker: string; recovery: string };

/**
 * A constant's value, followed from the name to the declaration.
 *
 * The build names its recovery commands rather than spelling them twice —
 * `RECOVERY` arrives from `scripts/lib/undo.mjs` under the name
 * `MUTATION_RECOVERY`, and `STRYKER_RECOVERY` is built out of the marker it
 * clears — and that is the property the whole arrangement exists for: one
 * spelling per command, so a message and this test cannot drift. A test that
 * read the name and then compared against a string typed here would put the
 * second spelling straight back.
 *
 * Three forms, and anything else throws rather than being guessed at: a quoted
 * string, a template whose `${…}` holes are themselves constants, and a bare
 * name declared somewhere in `scripts/`. Throwing matters more than reach — a
 * resolver that quietly returned the name it could not resolve would make
 * `toContain` assert that the build printed the word `STRYKER_RECOVERY`, which
 * it never will, and the test would be red for the wrong reason on the day
 * somebody merely renamed something.
 */
const valueOf = (expression: string): string => {
  const text = expression.trim();

  const quoted = /^'([^']*)'$/.exec(text);
  if (quoted) return quoted[1];

  const template = /^`([^`]*)`$/.exec(text);
  if (template) {
    return template[1].replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, name: string) => valueOf(name));
  }

  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    const declaration = new RegExp(`^(?:export )?const ${text} = (.+);$`, 'm');
    for (const source of [SOURCE, ...LIBRARY]) {
      const found = declaration.exec(source);
      if (found) return valueOf(found[1]);
    }
    throw new Error(`nothing in scripts/ declares \`const ${text} = …\``);
  }

  throw new Error(`cannot read \`${text}\` as a constant`);
};

/**
 * The leftover-artifact markers, read out of the build's own declarations.
 *
 * `scripts/build-content.mjs` pairs a `<X>_MARKER` with an `<X>_RECOVERY`, and
 * that pairing is what is read here: every marker the build declares, and the
 * command it says clears it. Not a list typed into this file — the two names
 * somebody remembers today are the two that go stale, and the third tool that
 * leaves something behind must arrive in this test by declaring itself over
 * there rather than by anybody remembering to come back here.
 *
 * Not imported, either. `build-content.mjs` does its work at import time, so an
 * import would run a build inside the test process — the reason
 * `packages/engine/tests/runnable.test.ts` gives for reading
 * `audit-scripts.mjs`'s document list the same way.
 *
 * It throws when it finds no marker, and `valueOf` throws when a marker has no
 * recovery beside it. Those two are what keep everything below from passing
 * vacuously: a parse that answered `[]` would make *the build refuses on every
 * marker it knows about* true of no markers at all, and a marker silently
 * dropped for want of a recovery is the same silence one level down. Both are
 * this repository's oldest way of being wrong.
 */
const artifactsIn = (source: string): Artifact[] => {
  const declared = [...source.matchAll(/^(?:export )?const ([A-Z][\w$]*)_MARKER = (.+);$/gm)];
  if (declared.length === 0) {
    throw new Error('build-content.mjs no longer declares any `const <X>_MARKER = …`');
  }

  return declared.map(([, name, expression]) => ({
    name,
    marker: valueOf(expression),
    recovery: valueOf(`${name}_RECOVERY`),
  }));
};

const ARTIFACTS = artifactsIn(SOURCE);

/**
 * The shapes a marker can be left in, both of which must be refused.
 *
 * The build asks `existsSync` and nothing more, so its claim is about a path
 * being occupied rather than about what occupies it — and holding it to both
 * shapes is what makes that claim rather than assuming it. It is not academic:
 * a Stryker sandbox is a directory and a mutation note is a file, so a check
 * that created one shape for every marker would be testing one guard properly
 * and the other one in a shape it never meets. `pendingMutation` reads its note
 * inside a `try`, which is why a directory where the note belongs still refuses
 * rather than throwing — asserted here rather than trusted.
 */
const SHAPES: Array<[string, (path: string) => void]> = [
  [
    'a file',
    (path) => {
      mkdirSync(dirname(path), { recursive: true });
      // Contents deliberately minimal. What a well-formed note makes the build
      // say is asserted in full by the rows against the real tree above; what
      // is asserted here is that the marker's mere presence is refused.
      writeFileSync(path, '{}');
    },
  ],
  [
    'a directory',
    (path) => {
      // A sandbox holds a copy of the tree, and the markdown in it is what made
      // the engine suite report a file that is not source.
      mkdirSync(join(path, 'sandbox-VERIFY'), { recursive: true });
      writeFileSync(join(path, 'sandbox-VERIFY', 'README.md'), '# a copy, not source\n');
    },
  ],
];

/**
 * A copy of the tree, to put a marker in.
 *
 * One of the markers is `.stryker-tmp` at the repository root, and creating
 * that here would be the test performing the accident on the machine it is
 * running on — every other suite in the same `bun run verify` would then be
 * looking at it, and a parallel agent's checkout would go red for this file's
 * doing. So the markers are created in a copy.
 *
 * `scripts/` is the whole copy, and that is enough rather than lazy: the build
 * resolves the repository from its own location (`REPO = join(HERE, '..')`) and
 * imports nothing outside `scripts/lib`, so a copied `scripts/` is a complete
 * repository as far as this program is concerned — and its output directory
 * lands under the copy too, which is a second reason the real
 * `packages/content/data` cannot be touched by these rows.
 */
const treeCopy = (): string => {
  const copy = mkdtempSync(join(room, 'tree-'));
  cpSync(join(REPO, 'scripts'), join(copy, 'scripts'), { recursive: true });
  for (const artifact of ARTIFACTS) {
    rmSync(join(copy, artifact.marker), { recursive: true, force: true });
  }
  return copy;
};

/** Leave exactly one marker in the copy, in one of the two shapes above. */
const leaveBehind = (copy: string, artifact: Artifact, shape: (path: string) => void): void => {
  for (const other of ARTIFACTS) rmSync(join(copy, other.marker), { recursive: true, force: true });
  shape(join(copy, artifact.marker));
};

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
      it(`refuses on every leftover-artifact marker it knows about, and says it rather than the dataset — ${why}, ${how}`, () => {
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

        // `RECOVERY`, not a command typed out again here. This line used to
        // read `toContain('bun scripts/audit-mutants.mjs')`, hand-typed, and
        // the day the constant became `node scripts/audit-mutants.mjs
        // --restore` — because `bun` on a `#!/usr/bin/env node` script is the
        // wrong runtime, and a plain re-run remakes decisions instead of
        // restoring — this test went red for spelling rather than for
        // behaviour. What is asserted is that the build prints THE constant;
        // the second assertion keeps the first from passing vacuously if
        // `RECOVERY` were ever emptied.
        //
        // Whether the constant itself names a runnable command is deliberately
        // not restated here: `scripts/audit-scripts.mjs` holds it against the
        // script's own shebang, and `packages/content/tests/undo.test.ts` holds
        // every exported command in `scripts/lib` to the same rule. Two copies
        // of one rule disagree — that is `scripts/lib/report.mjs:29-36`.
        expect(said).toContain(RECOVERY);
        expect(said).toContain('audit-mutants');

        // And not the other refusal. This is the ordering assertion: move the
        // mutation check below the regression guard and the empty-directory row
        // starts answering with this sentence instead.
        expect(said).not.toContain('found less than the dataset already has');

        // Every marker the build knows about, not the one this row began with.
        //
        // The rows above hand the note over with `--mutation-note`, which is a
        // path a flag can move. The markers below are the ones a stopped tool
        // actually leaves, at the places it actually leaves them, so each is
        // created in a copy of the tree rather than in this checkout — see
        // `treeCopy`. Same argv row, so the two axes that could plausibly
        // change the answer are still varying underneath.
        expect(ARTIFACTS.length).toBeGreaterThan(0);

        // The control gets its own copy, because it is the one run here that is
        // *allowed* to build: it writes an output directory, and the marker runs
        // below assert that no such directory exists.
        const control = treeCopy();
        const clean = spawnSync(
          process.execPath,
          [join(control, 'scripts', 'build-content.mjs'), '--src', EMPTY, ...force],
          { cwd: control, encoding: 'utf8' },
        );
        const cleanly = `${clean.stdout ?? ''}${clean.stderr ?? ''}`;
        // Not an assertion about its exit code. A build with no donor tree exits
        // 1 over stale spillover records — which is the point of the next line:
        // in a copy, a non-zero exit proves nothing at all, so what proves the
        // refusal below is the output and the absent directory, never the status.
        expect(existsSync(join(control, 'packages', 'content', 'data'))).toBe(true);

        const copy = treeCopy();

        for (const artifact of ARTIFACTS) {
          // A recovery command that had become the empty string would make
          // every `toContain` below pass over any output at all.
          expect(artifact.recovery.length, `${artifact.name} has no recovery`).toBeGreaterThan(0);

          // The control: with no marker on disk, the build does not print this
          // command. Without it, a guard that refused unconditionally — or a
          // build that printed every recovery it knows — would satisfy the
          // assertion after it.
          expect(cleanly, artifact.name).not.toContain(artifact.recovery);
        }

        for (const artifact of ARTIFACTS) {
          for (const [shaped, leave] of SHAPES) {
            const where = `${artifact.marker} as ${shaped}`;

            leaveBehind(copy, artifact, leave);

            const run = spawnSync(
              process.execPath,
              [join(copy, 'scripts', 'build-content.mjs'), '--src', src, ...force],
              { cwd: copy, encoding: 'utf8' },
            );
            const about = `${run.stdout ?? ''}${run.stderr ?? ''}`;

            expect(run.status, `${where}: ${about}`).not.toBe(0);
            expect(about, where).toContain(artifact.marker);
            expect(about, where).toContain(artifact.recovery);

            // It stopped before it did anything, and this is the assertion that
            // carries the claim. MEASURED while falsifying this file: with the
            // sandbox guard switched off, the build ran to the end and still
            // exited non-zero — over stale spillover records in a tree with no
            // donors — so `run.status` alone was satisfied by a build that had
            // refused nothing. The output directory is the thing a refusal
            // cannot have created, and the control above proves a build that
            // does not refuse creates it.
            expect(existsSync(join(copy, 'packages', 'content', 'data')), where).toBe(false);

            // The ordering claim, for each marker rather than for one of them:
            // a leftover artifact is answered before the dataset is judged, and
            // `--force` is not an escape hatch from it.
            expect(about, where).not.toContain('found less than the dataset already has');
          }
        }

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
