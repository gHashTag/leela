import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
// The same two functions `scripts/audit-scripts.mjs` uses, so the guard below
// asks the audit's question with the audit's own rule rather than a second one.
// @ts-expect-error - untyped .mjs
import { documentedRuntimes, runtimeOf } from '../../../scripts/lib/runnable.mjs';
// Typed by `scripts/lib/source.d.mts`, so this needs no directive either.
import { blank } from '../../../scripts/lib/source.mjs';
// Shared with the audit scripts, which are plain JavaScript. `undo.d.mts` now
// describes the whole module, so nothing here is imported under a directive —
// the `@ts-expect-error` that used to sit over `pendingMutation` made that
// import `any`, and an `any` turns every assertion about the shape it returns
// into a comment that looks like a check.
import {
  RECOVERY,
  UNREADABLE_RECOVERY,
  pendingMutation,
  putItBack,
  remember,
} from '../../../scripts/lib/undo.mjs';
import * as undoModule from '../../../scripts/lib/undo.mjs';

/**
 * The two functions `scripts/lib/undo.d.mts` does not describe yet.
 *
 * They are imported through a namespace and a cast, and the cast is worth a
 * paragraph rather than a shrug. `undo.d.mts` was outside the file list of the
 * pass that added `readArgv` and `putItBackOrRewrite`, and a declaration file
 * edited by two agents at once is a merge conflict in the one file that decides
 * whether anything else type-checks. So the shapes are written out here in full
 * instead of reached for with `any`: the doc-comment on `undo.d.mts` says in so
 * many words that a `@ts-expect-error` over this import once turned every
 * assertion about the returned shape into a comment that reads like a check,
 * and a cast to a precise type does not do that — get the shape wrong here and
 * the assertions below stop compiling.
 *
 * What it does not do is hold `undo.mjs` to these shapes. That is the honest
 * limit of it, and it is why moving both signatures into `undo.d.mts` is
 * written down as the piece left undone rather than left to be noticed.
 */
type ReadArgv = (
  args: readonly string[],
  known?: readonly string[],
) =>
  | { kind: 'usage' }
  | { kind: 'refused'; unknown: string[] }
  | { kind: 'run'; restoreOnly: boolean; notePath: string | null; names: string[] };

type PutItBackOrRewrite = (
  notePath: string,
  broke: { path: string; original: string },
) =>
  | { kind: 'restored'; path: string }
  | { kind: 'rewritten'; path: string; check: string }
  | { kind: 'unrestored'; path: string; original: string; recovery: string; why: string | null };

const { readArgv, putItBackOrRewrite, usage } = undoModule as unknown as {
  readArgv: ReadArgv;
  putItBackOrRewrite: PutItBackOrRewrite;
  usage: () => string;
};

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

/**
 * `putItBack`, refusing to answer "there was no note" when there was one.
 *
 * The three cases this module distinguishes are the whole of its contract, so
 * collapsing `null` into the others inside a test would be testing something
 * else. This throws with the note's path in the message instead.
 */
function restoreOf(note: string) {
  const back = putItBack(note);
  if (back === null) throw new Error(`a note is on disk at ${note} and putItBack called it nothing`);
  return back;
}

/** `pendingMutation`, the same way. */
function pendingOf(note: string) {
  const pending = pendingMutation(note);
  if (pending === null) {
    throw new Error(`a note is on disk at ${note} and pendingMutation called it nothing`);
  }
  return pending;
}

describe('a file a script broke on purpose', () => {
  it('comes back exactly as it was', () => {
    const { file, note } = broken('one', 'export const answer = 41;\n', 'export const answer = 0;\n');

    expect(restoreOf(note).restored).toBe(file);
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

/**
 * The note read by somebody who only wants to know, and to refuse.
 *
 * Restoring at the start of the next `audit-mutants` run helps whoever runs
 * `audit-mutants` next, and nobody does. The command this repository hands
 * people is `bun run verify`, and on 2026-08-06 it reported a stopped mutation
 * in `packages/ai/src/prompts.ts` as ten ordinary test failures in a package
 * nobody had touched. `pendingMutation` is what lets the first step of that
 * command say so instead.
 */
describe('a mutation run that was never finished', () => {
  /** Whatever a note might contain, written where nothing ships from. */
  function noteHolding(name: string, contents: string) {
    const note = join(room, `${name}.json`);
    writeFileSync(note, contents);
    return note;
  }

  it('says nothing when there is no note', () => {
    expect(pendingMutation(join(room, 'never-written.json'))).toBeNull();
  });

  it('names the broken file and the command that puts it back', () => {
    // Over notes of any shape that parses — a path with spaces, one with
    // non-ASCII in it, an original that is empty, one that is a whole file.
    const paths = [
      '/repo/packages/ai/src/prompts.ts',
      '/repo/a folder with spaces/thing.ts',
      '/repo/пакет/файл.ts',
      'relative/path.mjs',
    ];
    const originals = ['', 'export const a = 1;\n', 'const x = `${"a"}`;\n\t{}\n'];

    for (const path of paths) {
      for (const original of originals) {
        const note = noteHolding(`live-${paths.indexOf(path)}-${originals.indexOf(original)}`, JSON.stringify({ path, original }));
        const pending = pendingOf(note);

        expect(pending.path, `${path} / ${original.length} chars`).toBe(path);
        expect(pending.recovery).toBe(RECOVERY);
      }
    }
  });

  it('does not touch the broken file, because a build is not a repair', () => {
    // Restoring here would rewrite a shipped source file under a developer who
    // has been told nothing, and the repair would land in their commit.
    const { file, note } = broken('asking', 'the original\n', 'the mutation\n');

    pendingMutation(note);

    expect(readFileSync(file, 'utf8')).toBe('the mutation\n');
    expect(existsSync(note), 'and the note is still there for the run that will restore it').toBe(
      true,
    );
  });
});

/**
 * Every note a killed process can leave, rather than the ones somebody thought of.
 *
 * `remember` writes the note with a single `writeFileSync` and nothing makes
 * that atomic, so a kill mid-write leaves **some prefix** of the serialised
 * JSON on disk. Which prefix is a race, so the grid is every prefix — length
 * zero through the whole string — rather than a handful of hand-picked bad
 * inputs. A list of six known-bad strings tests the imagination of whoever
 * wrote the list; the edge of every column tests the shape.
 *
 * The two readers of that file used to disagree about it. MEASURED on
 * 2026-08-06: given a note holding the single character `{`, `pendingMutation`
 * answered `{ path: null, recovery: … }` and `putItBack` threw `SyntaxError`.
 * `putItBack` is the one that matters, because {@link RECOVERY} is the command
 * every message in this repository prints when the tree is broken — so the
 * recovery died on precisely the input that the doc-comment beside it already
 * called the likeliest one. (The command was then spelled with `bun`; it is
 * named through the constant here rather than quoted, for the reason the last
 * describe block in this file measures.)
 *
 * Three things are asserted over the whole grid, and each is a way the fix
 * could be wrong:
 *
 *  - Neither reader throws. A recovery that dies on its own motivating input
 *    teaches the person running it that the tooling is broken twice.
 *  - A note that could not be read is **still on disk afterwards**. It holds
 *    the only copy of the original text of a file that is wrong right now;
 *    deleting it to tidy up would destroy the evidence and silence the guard
 *    that stops the build, in one stroke.
 *  - The recovery in the message is the exported constant, not a copy of its
 *    text. Three hand-typed copies of one command is what this file found.
 *
 * **The width of this grid used to be the width of a temporary directory, and
 * that was the whole of a gap this repository spent three explanations on.**
 * The subject file was `join(room, 'grid-subject.ts')`, `room` came from
 * `mkdtempSync(join(tmpdir(), 'leela-undo-'))`, and every row of the grid is one
 * byte of `JSON.stringify({ path, original })` — so the number of cases in this
 * block was a function of how long this machine's `tmpdir()` happens to be.
 * MEASURED on 2026-08-06, by construction from the two paths: on macOS
 * `tmpdir()` is `/var/folders/cm/2n1qdh892xldd1rc2ly1jv8r0000gn/T` and the
 * serialised note is **134** bytes; on Linux, where `tmpdir()` is `/tmp`, the
 * same note is **90**. Delta **44**, and 44 was the entire published gap between
 * what this package ran here and what it ran on CI — 705 against 661 at commit
 * d0ad661, and later 739 against the same 661. Two prefix rows per byte of path,
 * 22 bytes of difference, 44 cases.
 *
 * That is not cosmetic. CI is the machine that gates a merge, and it was
 * exercising a third fewer truncation offsets than the author of a change sees
 * pass on their laptop — the shorter grid is a strict subset, so the rows only
 * CI could have failed on are rows CI never ran. The direction is the wrong one:
 * the gate saw less than the developer did.
 *
 * The guard that stood at the end of this block could not see any of it. It
 * asserted `serialised.length > 40` and `prefixes.length === serialised.length +
 * 1`, and both of those are true at 134 and true at 90 and true at any width a
 * `tmpdir()` could produce. It was a guard against a grid that had collapsed to
 * nothing, and it was blind by construction to a grid that merely changed size
 * from machine to machine. What replaces it asserts the width as a *number
 * written down here*, and that the note the grid is built from does not mention
 * this machine at all.
 *
 * So the path in the grid's note is a literal now. It names no file that exists,
 * which is the point — nothing about it can vary — and nothing in the grid ever
 * writes to it: every truncated note is unreadable by construction, and
 * `putItBack` refuses an unreadable note before it reaches a `writeFileSync`.
 * The one row that *is* a complete note is the one row that gets restored for
 * real, so that row alone is built around the temporary file below. `room` is
 * untouched and still serves `broken()` and every case in this file that writes
 * a real file; only the generated grid stopped depending on the machine.
 *
 * The `LANGUAGES`/`it.each` explanation that was offered for the same gap is
 * FALSE and was checked rather than argued with: `content.test.ts` reports 140
 * cases here and 140 on CI. Per-file counts named this file, at 171 against
 * CI's 127, and nothing else.
 */
describe('every note a process killed mid-write can leave', () => {
  /**
   * The path the grid's notes name: a literal, so the grid is the same width
   * everywhere. It is deliberately a path that does not exist — see the block
   * comment above; no note in the grid that names it is ever readable enough for
   * anything to try writing to it.
   */
  const GRID_PATH = '/repo/packages/content/src/grid-subject.ts';
  const ORIGINAL = 'export const answer = 41;\n';
  const MUTATED = 'export const answer = 0;\n';

  /** The real file the one complete note in the grid puts back. */
  const subject = join(room, 'grid-subject.ts');

  /** Exactly what `remember` puts on disk, so the prefixes are the real ones. */
  const serialised = JSON.stringify({ path: GRID_PATH, original: ORIGINAL });

  /** The same note about the file that really is on disk, for the row that restores. */
  const written = JSON.stringify({ path: subject, original: ORIGINAL });

  const prefixes = Array.from({ length: serialised.length + 1 }, (_, n) =>
    n === serialised.length
      ? // The write that was never interrupted. This row is about a real file
        // because it is the only row anything acts on.
        { why: 'the whole note, written in full', text: written, whole: true }
      : { why: `prefix of ${n}/${serialised.length} bytes`, text: serialised.slice(0, n), whole: false },
  );

  // Notes that parse but are not notes. A truncated write can land on valid
  // JSON — `{"path":null}` is a few keystrokes from one — and `writeFileSync`
  // given a number for a path throws exactly as loudly as `JSON.parse` did.
  const wrongShape = [
    { why: 'path is a number', text: JSON.stringify({ path: 42, original: ORIGINAL }), whole: false },
    { why: 'path is null', text: JSON.stringify({ path: null, original: ORIGINAL }), whole: false },
    { why: 'path is an object', text: JSON.stringify({ path: { p: GRID_PATH }, original: '' }), whole: false },
    { why: 'path is missing', text: JSON.stringify({ original: ORIGINAL }), whole: false },
    { why: 'original is a number', text: JSON.stringify({ path: GRID_PATH, original: 7 }), whole: false },
    { why: 'original is missing', text: JSON.stringify({ path: GRID_PATH }), whole: false },
    { why: 'the note is an array', text: JSON.stringify([GRID_PATH, ORIGINAL]), whole: false },
    { why: 'the note is a bare null', text: 'null', whole: false },
    { why: 'the note is not JSON at all', text: 'not json at all', whole: false },
    { why: 'the note is a log line', text: 'Killed: 9\n', whole: false },
  ];

  for (const { why, text, whole } of [...prefixes, ...wrongShape]) {
    it(`answers rather than throwing — ${why}`, () => {
      const note = join(room, `grid-${why.replace(/\W+/g, '-')}.json`);
      writeFileSync(subject, MUTATED);
      writeFileSync(note, text);

      // A note exists, whatever is in it, so both readers must say so.
      const pending = pendingOf(note);
      expect(pending.recovery).toBe(RECOVERY);

      const back = restoreOf(note);

      if (back.restored === null) {
        // Could not be read. The note is the only copy of the original text.
        expect(existsSync(note), 'an unreadable note is evidence, not litter').toBe(true);
        expect(readFileSync(note, 'utf8'), 'and it was not rewritten either').toBe(text);
        expect(back.recovery).toBe(UNREADABLE_RECOVERY);
        expect(readFileSync(subject, 'utf8'), 'and the broken file was left alone').toBe(MUTATED);
      } else {
        // The only readable note in the grid is the one complete write. A
        // truncated note that got this far is a reader acting on a prefix.
        expect(whole, `${why}: an incomplete note was acted on`).toBe(true);
        expect(back.restored).toBe(subject);
        expect(back.recovery).toBeNull();
        expect(readFileSync(subject, 'utf8')).toBe(ORIGINAL);
        expect(existsSync(note), 'a note it used is forgotten').toBe(false);

        // The two readers agree about a note that can be read. They do not
        // always agree that one cannot — see below.
        expect(pending.path).toBe(back.restored);
      }

      rmSync(note, { force: true });
    });
  }

  /**
   * The obvious sentence about these two readers is false, and this records it.
   *
   * *Whatever one reader calls unreadable the other does too* was written into
   * this grid as an assertion and MEASURED false on the first run, on two rows:
   * `{"path": "/…/grid-subject.ts", "original": 7}` and the same note with
   * `original` absent. `pendingMutation` named the file — correctly, the note
   * says which file plainly — while `putItBack` refused, also correctly, since
   * there is no text to put back and `writeFileSync(path, 7)` would throw.
   *
   * They are asking different questions, so they are allowed to differ in this
   * one direction and only this one: a note may be good enough to *name* a
   * broken file and not good enough to *repair* it. The direction that would be
   * a defect is the opposite — a note `putItBack` is willing to act on that
   * `pendingMutation` calls nothing, which would restore a file while the build
   * that should have refused sailed past. That is what is asserted here.
   */
  it('never repairs from a note the guard would have called nothing', () => {
    for (const { why, text } of [...prefixes, ...wrongShape]) {
      const note = join(room, 'direction.json');
      writeFileSync(subject, MUTATED);
      writeFileSync(note, text);

      const pending = pendingMutation(note);
      const back = putItBack(note);

      if (back !== null && back.restored !== null) {
        expect(pending, why).not.toBeNull();
        expect(pending?.path, why).toBe(back.restored);
      }

      rmSync(note, { force: true });
    }
  });

  it('has a grid of a width written down here, not one this machine chose', () => {
    // Guards the guard, and the old one could not. It asked `serialised.length >
    // 40`, which is true at 134 bytes on a Mac and true at 90 on Linux and true
    // at every width in between — so the grid quietly changed size with the
    // machine and every assertion about it stayed green. The width is a fact
    // now: state it, and a change to the note's shape has to be stated too.
    expect(serialised.length).toBe(94);

    // And the fact is not about this machine. The note the grid is built from
    // must not mention the temporary directory at all — that mention is what
    // made 44 cases appear and disappear between a laptop and CI.
    expect(serialised, 'the grid is built from a path this machine chose').not.toContain(tmpdir());

    expect(prefixes.length).toBe(serialised.length + 1);
  });
});

/**
 * The two scripts that print the alarm, driven for real.
 *
 * The unit assertions above hold `undo.mjs` to its contract; these hold the
 * callers to using it. `audit-scripts.mjs` did not import this module at all —
 * it raw-parsed the note in two places, so in CI a corrupt note produced an
 * uncaught `SyntaxError` and the runtime audit never ran. That is measured:
 * against a copy of the script, a note holding
 * `{"path": "…prompts.ts", "orig` exited on a stack trace at the parse.
 *
 * Both are driven through `--mutation-note`, never the real
 * `scripts/.mutants-undo.json`: a note left there by a test would block every
 * build on this machine, including the one that recovers from it.
 */
describe('the scripts that tell somebody the tree is broken', () => {
  const ROOT = new URL('../../../', import.meta.url).pathname;

  it('writes its notes somewhere disposable, never where the real one lives', () => {
    // Asserted about this file's own choice rather than about the machine: a
    // check that fails when somebody genuinely has a stopped mutation would be
    // crying wolf at the one moment the guard is right.
    expect(room.startsWith(tmpdir()) || room.startsWith(`/private${tmpdir()}`)).toBe(true);
    expect(join(room, 'x.json')).not.toBe(join(ROOT, 'scripts', '.mutants-undo.json'));
  });

  it('diagnoses a half-written note instead of dying on it', () => {
    const note = join(room, 'audit-scripts-corrupt.json');
    writeFileSync(note, '{"path": "/repo/packages/ai/src/prompts.ts", "orig');

    const run = spawnSync(
      process.execPath,
      [join(ROOT, 'scripts', 'audit-scripts.mjs'), '--mutation-note', note],
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
    );
    const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;

    // The failure this exists to catch: a stack trace where a diagnosis belongs.
    expect(said, said).not.toContain('SyntaxError');
    expect(said, said).not.toContain('at JSON.parse');

    expect(said).toContain('A stopped mutation run left a file broken on purpose');
    expect(said).toContain(RECOVERY);

    // And it got past the note to the check it exists to run.
    expect(said).toContain('against the runtime each names');
    expect(run.status).toBe(1);

    // The evidence is still there. This is the note's only copy.
    expect(existsSync(note)).toBe(true);
    rmSync(note, { force: true });
  });

  it('restores and stops, rather than restoring and starting a fresh sweep', () => {
    // The defect in the printed recovery: `audit-mutants` restored at the top
    // and then broke files for several minutes, so somebody who ran the
    // command and stopped it at the line it told them to expect was left with
    // a new mutation in a different file.
    //
    // A decision name that matches nothing is passed as well, so that if the
    // flag were ignored this test still cannot mutate a shipped file — the
    // proof that it exits early is the absence of the sweep's own summary
    // line, not the absence of damage.
    const file = join(room, 'restore-only.ts');
    const note = join(room, 'restore-only.json');

    writeFileSync(file, 'export const answer = 41;\n');
    remember(note, file, 'export const answer = 41;\n');
    writeFileSync(file, 'export const answer = 0;\n');

    const run = spawnSync(
      process.execPath,
      [
        join(ROOT, 'scripts', 'audit-mutants.mjs'),
        '--restore',
        '--mutation-note',
        note,
        'no-such-decision',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
    );
    const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;

    expect(run.status, said).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe('export const answer = 41;\n');
    expect(existsSync(note)).toBe(false);

    // It never reached the sweep, which prints this whatever it broke.
    expect(said, said).not.toContain('decisions on purpose');
  });

  it('is the command the messages print', () => {
    // The three hand-typed copies are why this is asserted rather than read:
    // a recovery that names a sweep, or a flag the script does not parse, is a
    // message that sends somebody somewhere useless.
    expect(RECOVERY).toContain('audit-mutants.mjs');
    expect(RECOVERY).toContain('--restore');
    // The runtime is not asserted here. It belongs to the sweep at the end of
    // this file, which reads the shebang rather than restating a word — a
    // second spelling of `node` in this line is the defect that sweep exists
    // for, one file further along.

    // Blanked, under the repository-wide rule in `apps/mobile/tests/source.test.ts`
    // that a claim about source text is made about code. It is not decoration
    // here: MEASURED, `--restore` appears three times in that script and only
    // one of them is code — the usage block at the top and the paragraph above
    // the parse are the other two. A check reaching for the bare flag would
    // pass on a script that documents a flag it never looks at. The needles
    // below are code, and they survive blanking because `blank` erases comments
    // and leaves string contents alone, which was measured too rather than read
    // off the doc-comment.
    //
    // The needle used to be `args.includes('--restore')` in the script itself.
    // The reading moved into `undo.mjs` when an unrecognised flag turned out to
    // be a full destructive sweep, so it is followed rather than dropped: the
    // script must reach the parser, and the flag must be code in the parser.
    // Dropping it and asserting only about `undo.mjs` would leave a script free
    // to go back to reading argv for itself.
    const source = blank(readFileSync(join(ROOT, 'scripts', 'audit-mutants.mjs'), 'utf8'));
    expect(source).toContain('readArgv(');

    // The filter that discarded every flag it did not know, which is how
    // `--help` became the bare sweep. Named as the thing that must not come
    // back rather than described.
    expect(source, 'a script that reads argv for itself again').not.toContain("startsWith('--')");

    const parser = blank(readFileSync(join(ROOT, 'scripts', 'lib', 'undo.mjs'), 'utf8'));
    expect(parser).toContain("'--restore'");
  });
});

/**
 * The step that announces a stopped mutation, and the fact that it goes first.
 *
 * `content:build` refuses to build while `scripts/.mutants-undo.json` is on
 * disk, and that refusal is the only place on the path anybody walks where a
 * stopped mutation is named out loud. It works because `verify` runs it before
 * the tests: by the time `test` runs, the damage has already been reported as
 * ten ordinary failures in a package nobody touched, which is what cost an hour
 * on 2026-08-06.
 *
 * Nothing held that ordering. Move `bun run test` to the front of `verify` and
 * every assertion in this file still passes, `content:build` still refuses when
 * it eventually runs, and the protection is gone — the developer sees the red
 * tests first and the diagnosis after they have stopped reading. A silent
 * reorder that leaves a guard passing is this repository's recurring shape.
 *
 * So the claim is made about the manifest rather than about a name: *whatever
 * `verify` runs first is a step that refuses on a stopped mutation.* The
 * current first step is not written down here, and neither are the current four
 * steps — a test asserting `startsWith('bun run content:build')` would have
 * passed through the rename that motivates half of this file, and a test
 * counting four steps would fail on a fifth that changed nothing. Script
 * indirection is followed generically, `bun run <name>` to `scripts[name]`,
 * because `verify`'s steps are names and not commands.
 *
 * `package.json` is read, never written. The falsification for this test is to
 * reorder `verify` by hand, watch it go red, and put the manifest back.
 */
describe('the first thing the command in the README runs', () => {
  const ROOT = new URL('../../../', import.meta.url).pathname;
  const MANIFEST = join(ROOT, 'package.json');

  /** The scripts table, as the thing that runs `verify` would read it. */
  function manifestScripts(): Record<string, string> {
    const parsed: unknown = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const scripts = (parsed as { scripts?: Record<string, string> }).scripts;
    if (!scripts) throw new Error(`${MANIFEST} has no scripts table`);
    return scripts;
  }

  /** The first thing a chained command does, whatever else it goes on to do. */
  function firstStep(command: string): string {
    const [first = ''] = command.split('&&');
    return first.trim();
  }

  /**
   * `bun run typecheck` followed to what `typecheck` actually is.
   *
   * One level would be enough today and is not asserted: a step that names a
   * script naming a script is a legal manifest, and the depth cap is there so a
   * table that refers to itself ends the test rather than the machine.
   */
  function resolved(command: string, scripts: Record<string, string>): string {
    let step = firstStep(command);

    for (let depth = 0; depth < 8; depth += 1) {
      const named = /^(?:bun|npm|pnpm|yarn)\s+run\s+([\w:.-]+)$/.exec(step);
      const next = named?.[1] === undefined ? undefined : scripts[named[1]];
      if (next === undefined) return step;
      step = firstStep(next);
    }

    throw new Error(`script indirection in ${MANIFEST} does not end: ${command}`);
  }

  /** The `.mjs` a command runs, or nothing — a step may be no such thing. */
  function scriptIn(command: string): string | null {
    const found = /(?:^|\s)([\w./-]+\.mjs)(?:\s|$)/.exec(command);
    return found?.[1] === undefined ? null : join(ROOT, found[1]);
  }

  it('is a step that reads the note, and that is derived from the manifest', () => {
    const scripts = manifestScripts();
    const verify = scripts.verify;
    expect(verify, `${MANIFEST} has no \`verify\` script; the README tells people to run it`)
      .toBeTypeOf('string');

    const step = resolved(verify ?? '', scripts);
    const script = scriptIn(step);

    expect(
      script,
      `\`verify\` begins with \`${firstStep(verify ?? '')}\`, which resolves to \`${step}\` — no ` +
        `script that could read scripts/.mutants-undo.json. A stopped mutation now reports as ` +
        `ordinary test failures.`,
    ).not.toBeNull();
    expect(existsSync(script ?? ''), `${step} names ${script}, which is not there`).toBe(true);

    // It imports the reader, rather than parsing the note itself. Blanked,
    // because that script's own doc-comment explains `pendingMutation` at
    // length and a raw search would find the explanation.
    const source = blank(readFileSync(script ?? '', 'utf8'));
    const UNDO = join(ROOT, 'scripts', 'lib', 'undo.mjs');
    const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].filter(
      ([, , from = '']) => resolve(dirname(script ?? ''), from) === UNDO,
    );

    expect(imports.length, `${script} does not import from ${UNDO}`).toBeGreaterThan(0);
    expect(
      imports.some(([, names = '']) => names.split(',').some((n) => n.trim() === 'pendingMutation')),
      `${script} imports from undo.mjs but not \`pendingMutation\``,
    ).toBe(true);
  });

  it('refuses, and says so, while a note is on disk', () => {
    // The import above could be an unused one. This runs the step the manifest
    // named, against a note pointing at a file in a temporary directory, and
    // asks for the exit code the `&&` chain reads.
    const scripts = manifestScripts();
    const step = resolved(scripts.verify ?? '', scripts);
    const script = scriptIn(step);
    expect(script, `no script in \`${step}\``).not.toBeNull();

    const { file, note } = broken('verify-first-step', 'the original\n', 'the mutation\n');

    const run = spawnSync(process.execPath, [script ?? '', '--mutation-note', note], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120_000,
    });
    const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;

    expect(run.status, said).not.toBe(0);
    expect(said, said).toContain(file);
    expect(said, said).toContain(RECOVERY);

    // And it did not repair anything on the way past, which would hide the
    // damage inside somebody's commit.
    expect(readFileSync(file, 'utf8')).toBe('the mutation\n');
    expect(existsSync(note)).toBe(true);
    rmSync(note, { force: true });
  });
});

/**
 * Every command this repository's own code prints, held to the shebang of the
 * script it names.
 *
 * `RECOVERY` above is the sentence three programs print at the moment shipped
 * source is broken on purpose: `audit-scripts.mjs`, `build-content.mjs` — the
 * first step of `bun run verify` — and `audit-mutants.mjs` itself when it
 * cannot read its own note. It was `bun scripts/audit-mutants.mjs --restore`
 * for a script whose shebang is `#!/usr/bin/env node` and whose own header says
 * node twice. Two statements of one command disagreeing, in the two files a
 * person opens at the worst moment there is.
 *
 * **The point is not that `bun` fails.** MEASURED on 2026-08-06: both runtimes
 * execute that script today, and `--restore` returns before any decision is
 * read, so under either one the command restores and stops. The point is that
 * this exact mismatch is `audit-scripts.mjs`'s entire subject — its recorded
 * finding is `bun scripts/board-overlay.mjs` in `CLAUDE.md` for a node-shebang
 * script — and that the audit could not see this one. Its `documented` map was
 * built from seven markdown files, and no markdown in this repository names
 * `audit-mutants.mjs` with a runtime at all. The most consequential command
 * here was outside the check by construction, and was spelled the one way the
 * check exists to forbid.
 *
 * So the rule asserted here is the shape rather than these two constants:
 * **over every module in `scripts/lib`, every string reachable from its exports
 * that names a `scripts/*.mjs` together with a runtime must name the runtime
 * that file's shebang declares.** Listing `RECOVERY` and `UNREADABLE_RECOVERY`
 * would test the imagination of whoever wrote the list; the constant somebody
 * adds next month is the one this has to catch, and it will be caught without
 * anybody editing this file.
 *
 * The exports are read by importing each module and walking its values, not by
 * regex over its source. A doc-comment in `undo.mjs` quotes the old `bun`
 * spelling deliberately, as history — a source scan would fail on the record of
 * the defect, which is the kind of check somebody deletes rather than obeys.
 * Importing is safe here and that was measured: every one of the 26 modules in
 * `scripts/lib` imports cleanly with no output and no file written, because
 * they are libraries; the scripts that *do* things are one directory up and are
 * never imported.
 *
 * What a command looks like is `documentedRuntimes`, the same function the
 * audit runs over the documents. One rule, asked in two places, rather than a
 * second rule here that could drift from it — which is the defect this whole
 * block is about, one level up.
 *
 * Non-vacuity is asserted out loud. A sweep that found no commands would pass
 * over nothing and read exactly like a sweep that found them all: this
 * repository's oldest failure, and the reason `auditedDocuments` in
 * `packages/engine/tests/runnable.test.ts` throws rather than returning `[]`.
 *
 * FALSIFIED on 2026-08-06 rather than assumed, twice, and both were observed
 * before `node` went back in.
 *
 *  - With `bun` put back in `RECOVERY`, this failed with *scripts/lib/undo.mjs
 *    exports RECOVERY: `bun scripts/audit-mutants.mjs --restore` — but
 *    scripts/audit-mutants.mjs declares node: expected 'bun' to be 'node' //
 *    Object.is equality*, and `node scripts/audit-scripts.mjs` exited 1 saying
 *    ``scripts/audit-mutants.mjs: documented as `bun scripts/audit-mutants.mjs`,
 *    but it declares node``.
 *  - With `RECOVERY` set to `put it back by hand` — a string naming no script,
 *    which is how this sweep would go quietly blind — the non-vacuity assertion
 *    fired: *no exported string in …/scripts/lib names a script with a runtime
 *    — the sweep compared nothing: expected [] to not deeply equal []*. The
 *    runtime comparison passed in that run, over nothing, which is the whole
 *    reason the second assertion is there.
 */
describe('a command the code itself prints', () => {
  const ROOT = new URL('../../../', import.meta.url).pathname;
  const LIB = join(ROOT, 'scripts', 'lib');

  /**
   * Every string reachable from an exported value.
   *
   * Depth-limited rather than exhaustive: an exported string, an array of them,
   * a record of them. A command buried deeper than that is not a command
   * somebody is reading off a message, and an unbounded walk over a module
   * namespace is a test that hangs on a cycle instead of failing.
   */
  function stringsIn(value: unknown, depth = 0): string[] {
    if (typeof value === 'string') return [value];
    if (depth >= 4 || value === null || typeof value !== 'object') return [];
    return Object.values(value as Record<string, unknown>).flatMap((inner) =>
      stringsIn(inner, depth + 1),
    );
  }

  it('names the runtime that script declares, over all of scripts/lib', async () => {
    const modules = readdirSync(LIB)
      .filter((name) => name.endsWith('.mjs'))
      .sort();

    expect(modules.length, `${LIB} holds no .mjs modules to sweep`).toBeGreaterThan(0);

    /** Every command found, so the sweep can be shown to have swept something. */
    const found: string[] = [];

    for (const name of modules) {
      const module = (await import(pathToFileURL(join(LIB, name)).href)) as Record<string, unknown>;

      for (const [exported, value] of Object.entries(module)) {
        for (const text of stringsIn(value)) {
          for (const [script, runtimes] of documentedRuntimes(text) as Map<string, Set<string>>) {
            const where = `scripts/lib/${name} exports ${exported}: \`${text}\``;
            const path = join(ROOT, script);

            expect(existsSync(path), `${where} — but ${script} is not there`).toBe(true);

            // The shebang, read now, rather than a word restated in this file.
            const declares = runtimeOf(readFileSync(path, 'utf8')) as string | null;
            expect(declares, `${where} — but ${script} has no shebang at all`).not.toBeNull();

            for (const runtime of runtimes) {
              found.push(`${where} -> ${runtime} ${script}`);
              expect(runtime, `${where} — but ${script} declares ${declares}`).toBe(declares);
            }
          }
        }
      }
    }

    // Guards the guard. Rename `RECOVERY`, stop exporting it, or break the
    // command shape, and the loop above would sail through having compared
    // nothing at all.
    expect(
      found,
      `no exported string in ${LIB} names a script with a runtime — the sweep compared nothing`,
    ).not.toEqual([]);

    /*
     * Thirty seconds, and the number is measured rather than picked.
     *
     * This test IMPORTS every `.mjs` in `scripts/lib` — thirty modules and
     * about 350 KB on 2026-08-28 — because the commands it checks live in
     * exported *values*, so a text scan would miss them. That cost is real and
     * it grows: every module added to `scripts/lib` adds another compile.
     *
     * On 2026-08-28 it went red at `origin/unified` with nothing changed:
     * **5104 ms against the 5000 ms default.** Run on its own the same minute
     * it took 480 ms. It is not slow — it is starved, competing with eleven
     * other workspaces' vitest processes for the same cores, which is the
     * shape this repository has recorded before and mistaken for a real defect
     * twice.
     *
     * So the deadline is the one thing that was wrong, and it is set here with
     * headroom for the growth rather than trimmed to today's worst: six times
     * the observed contended figure still fails a genuine hang, and does not
     * fail the next module somebody adds.
     */
  }, 30_000);
});

/**
 * An argument this script does not understand, over every shape one can have.
 *
 * MEASURED by reading `scripts/audit-mutants.mjs` before the repair: the names
 * were `args.filter((arg) => !arg.startsWith('--'))`, so **every unknown flag
 * was discarded**; an empty list of names then means *the operator named no
 * decisions*, and that means the whole table. `--help`, `-h`, `--dry-run`,
 * `--list` and a typo'd `--restor` were each, exactly, the bare command — which
 * edits shipped source in place for several minutes. There was no `--help`
 * handler in the file at all. The first thing anybody tries on a tool they do
 * not know was the destructive sweep, silently, in the one script whose stopped
 * runs have cost this project an hour twice.
 *
 * So the grid is built out of the *shape* of a flag rather than the flags
 * somebody thought of: `--`+word, `-`+letter, `--`+word+`=`+value, alone, in
 * pairs, and interleaved with real decision names, with `--restore` and with
 * `--mutation-note <path>`. A list of six known-bad flags would test the
 * imagination of whoever wrote the list; the next flag a person invents is by
 * definition not on it.
 *
 * One invariant is asserted over the whole grid, and it is the one that
 * matters — not *the parser rejects these five strings* but: **an argv the
 * parser does not understand in full never reaches the shape that mutates
 * everything.** `run` is that shape, because the sweep reads no names as all
 * names. `refused` and `usage` cannot break a file whatever else is wrong with
 * them.
 *
 * `--restore` is the one exception, and it is one on purpose rather than by
 * omission: it exits before a decision is selected, so `readArgv` returns no
 * names at all for it. That is asserted here too, because it is the reason a
 * bogus name is safe in that mode — and the restore test above passes one
 * deliberately.
 */
describe('an argument this script does not understand', () => {
  /**
   * The names the caller's table happens to hold.
   *
   * Made up rather than imported. `audit-mutants.mjs` runs its sweep on import,
   * so its `DECISIONS` cannot be read from a test without breaking shipped
   * source to do it, and the parser is a pure function that is *told* the names
   * by its caller. That the caller tells it the real ones is asserted further
   * down, by running the script.
   */
  const KNOWN = ['alpha', 'beta'];

  /** Everything that begins with a dash: the two real flags and the shapes of the rest. */
  const FLAG_SHAPED = [
    '--restore',
    '--mutation-note',
    '--help',
    '-h',
    '--dry-run',
    '--list',
    '--restor',
    '--force',
    '--mutation-notes',
    '-r',
    '-n',
    '-x',
    '--',
    '--restore=1',
    '--mutation-note=/tmp/n.json',
    '--help=yes',
  ];

  /** Everything that does not: two real names, and three things that are not names. */
  const WORD_SHAPED = ['alpha', 'beta', 'gamma', '', 'alpha=1'];

  const ALPHABET = [...FLAG_SHAPED, ...WORD_SHAPED];
  const NOTE = join(room, 'argv-grid-note.json');

  const bare = [
    ...ALPHABET.map((one) => [one]),
    ...ALPHABET.flatMap((one) => ALPHABET.map((two) => [one, two])),
  ];

  // The same vectors again with each real flag before and after them, because
  // a parser that reads argv positionally can be right about a token alone and
  // wrong about it beside something it consumes.
  const vectors = bare.flatMap((vector) => [
    vector,
    ['--restore', ...vector],
    [...vector, '--restore'],
    ['--mutation-note', NOTE, ...vector],
    [...vector, '--mutation-note', NOTE],
  ]);

  /**
   * The vector as anything reading it must see it: the token after
   * `--mutation-note` is that flag's value, not a decision name.
   *
   * This is the one piece of parsing the test does for itself, and it is
   * deliberately the smallest: it is only ever consulted when `readArgv` has
   * already said `run`, and `run` implies the flag was well formed.
   */
  function split(vector: readonly string[]) {
    const flags: string[] = [];
    const words: string[] = [];

    for (let index = 0; index < vector.length; index += 1) {
      const token = vector[index];
      if (token.startsWith('-')) {
        flags.push(token);
        if (token === '--mutation-note') index += 1;
        continue;
      }
      words.push(token);
    }

    return { flags, words };
  }

  it('never reaches the shape that mutates everything', () => {
    for (const vector of vectors) {
      const why = JSON.stringify(vector);
      const out = readArgv(vector, KNOWN);

      expect(['usage', 'refused', 'run'], why).toContain(out.kind);

      if (out.kind === 'usage') continue;

      if (out.kind === 'refused') {
        // A refusal has to name what it refused, or the operator is told only
        // that they are wrong.
        expect(out.unknown.length, why).toBeGreaterThan(0);
        for (const token of out.unknown) expect(vector, why).toContain(token);
        continue;
      }

      const { flags, words } = split(vector);

      if (out.restoreOnly) {
        expect(out.names, `${why}: a restore selects nothing, so it carries no names`).toEqual([]);
        continue;
      }

      // This is the sweep. Every flag in it is one of the two that exist, and
      // every word in it is a decision the table really holds.
      expect(
        flags.filter((flag) => flag !== '--restore' && flag !== '--mutation-note'),
        `${why}: reached the sweep carrying a flag nothing understands`,
      ).toEqual([]);
      expect(
        words.filter((word) => !KNOWN.includes(word)),
        `${why}: reached the sweep carrying a name that is not a decision`,
      ).toEqual([]);
      expect(out.names, `${why}: the sweep would break something nobody named`).toEqual(words);
    }
  });

  it('has a grid that contains the arguments that motivated it', () => {
    // Guards the guard. A grid that had lost its flag-shaped tokens — or been
    // built from an alphabet of names only — would pass the invariant above
    // while asserting nothing about the defect.
    expect(vectors.length).toBeGreaterThan(1000);
    for (const flag of ['--help', '-h', '--dry-run', '--list', '--restor']) {
      expect(vectors.some((vector) => vector.length === 1 && vector[0] === flag), flag).toBe(true);
    }
    expect(vectors.some((vector) => vector.length === 0)).toBe(false);
  });

  it('answers a request for help with the way back, rather than with a sweep', () => {
    for (const vector of [['--help'], ['-h'], ['--help', 'alpha'], ['--restore', '--help']]) {
      expect(readArgv(vector, KNOWN).kind, JSON.stringify(vector)).toBe('usage');
    }

    // Built from the constant rather than retyped, which is the property the
    // whole of `RECOVERY`'s doc-comment is about: one spelling of the command
    // that puts a broken tree back.
    expect(usage()).toContain(RECOVERY);
  });
});

/**
 * The two arms of the restore that runs *inside* the sweep, which were backwards.
 *
 * `putItBack` is for the next process; the one that broke the file is gone and
 * the note is the only copy. This is the other case: `audit-mutants` in its
 * `finally`, still holding the original text in a local variable. MEASURED by
 * reading the code before the repair — the unreadable note, where the note
 * itself still held the original, printed a recovery command; the note being
 * **gone**, where the only surviving copy was in scope one line above, printed
 * `The note is gone.` and exited, writing nothing, under the sentence *stopping
 * before anything else is broken*. An all-clear at the moment shipped source is
 * wrong on disk with nothing on disk pointing at it.
 *
 * The invariant is stated over the arms rather than case by case, because the
 * defect was not any one arm being wrong: it was that nothing held the arms to
 * a common promise. **No arm may both fail to restore the file and leave the
 * caller without the text that would.** How it says so is not asserted — the
 * wording of a message is not the contract, and a test that pinned the wording
 * would have passed on the old code, which said something perfectly clear and
 * did nothing.
 */
describe('a mutation the run that made it has to undo', () => {
  const ORIGINAL = 'export const answer = 41;\n';
  const MUTATED = 'export const answer = 0;\n';

  /** Each state the note can be in when the `finally` reaches it, plus a write that cannot land. */
  const arms = [
    {
      why: 'the note is readable',
      set: () => broken('arm-readable', ORIGINAL, MUTATED),
    },
    {
      why: 'the note is there and will not parse',
      set: () => {
        const made = broken('arm-unreadable', ORIGINAL, MUTATED);
        writeFileSync(made.note, '{"path": "/repo/src/x.ts", "orig');
        return made;
      },
    },
    {
      why: 'the note is gone',
      set: () => {
        const made = broken('arm-no-note', ORIGINAL, MUTATED);
        rmSync(made.note);
        return made;
      },
    },
    {
      why: 'the note is gone and the file cannot be written',
      set: () => ({
        // A directory that does not exist, so `writeFileSync` throws. The
        // process is dying either way; the question is whether it dies holding
        // the only copy of the text and saying nothing about it.
        file: join(room, 'no-such-directory', 'arm-unwritable.ts'),
        note: join(room, 'arm-unwritable.json'),
      }),
    },
  ];

  it('either puts the file back or hands back the text that would, in every arm', () => {
    const kinds: string[] = [];

    for (const arm of arms) {
      const { file, note } = arm.set();
      const outcome = putItBackOrRewrite(note, { path: file, original: ORIGINAL });

      expect(['restored', 'rewritten', 'unrestored'], arm.why).toContain(outcome.kind);
      kinds.push(outcome.kind);

      const onDisk = existsSync(file) ? readFileSync(file, 'utf8') : null;
      const restored = onDisk === ORIGINAL;
      const carries = outcome.kind === 'unrestored' && outcome.original === ORIGINAL;

      expect(
        restored || carries,
        `${arm.why}: the file was not put back and the outcome does not carry the text that would`,
      ).toBe(true);

      if (outcome.kind === 'unrestored') {
        // Not restored is allowed. Not restored and silent about how is not:
        // whatever the message says, the caller has the text and a command.
        expect(outcome.original, arm.why).toBe(ORIGINAL);
        expect(typeof outcome.recovery, arm.why).toBe('string');
        expect(outcome.recovery.length, arm.why).toBeGreaterThan(0);
      } else {
        // It claimed to have put the file back, so the file is back.
        expect(onDisk, `${arm.why}: it reported ${outcome.kind} and the file is still mutated`).toBe(
          ORIGINAL,
        );
      }
    }

    // Guards the guard, twice over. If every arm restored, the second half of
    // the disjunction above would be dead and could be deleted unnoticed; if no
    // arm restored, the first half would be. Both halves are exercised.
    expect(kinds, `arms: ${kinds.join(', ')}`).toContain('unrestored');
    expect(kinds, `arms: ${kinds.join(', ')}`).toContain('rewritten');
    expect(kinds.length).toBe(arms.length);
  });
});

/**
 * The script itself, given the argument that used to mean *break everything*.
 *
 * The grid above holds the parser. This holds the caller to using it, and to
 * telling it the real decision names — a pure function refusing `--dry-run` is
 * worth nothing if `audit-mutants.mjs` still reads argv for itself.
 *
 * Run against the real repository root on purpose: the whole claim is that the
 * process exits before it touches a file, so the check is that it exits
 * non-zero having written no note and mutated nothing. A `--mutation-note` into
 * the temporary room is passed anyway, so that a run which somehow got past the
 * refusal still could not put a note where every build on this machine would
 * read it.
 */
describe('the flags the script does not have, given to the script', () => {
  const ROOT = new URL('../../../', import.meta.url).pathname;

  for (const argument of ['--help', '-h', '--dry-run', '--list', '--restor']) {
    it(`refuses ${argument} instead of sweeping the whole table`, () => {
      const note = join(room, `cli-${argument.replace(/\W+/g, '-')}.json`);

      const run = spawnSync(
        process.execPath,
        [join(ROOT, 'scripts', 'audit-mutants.mjs'), argument, '--mutation-note', note],
        { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
      );
      const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;

      // Non-zero: this script's exit code answers *a sweep ran and everything
      // was defended*, and neither a usage text nor a refusal is that.
      expect(run.status, said).not.toBe(0);

      // It never reached the sweep, which prints this line whatever it broke.
      expect(said, said).not.toContain('decisions on purpose');

      // And it said how to get out of a broken tree, which is the one thing
      // somebody reading a usage text on this script is likeliest to need.
      expect(said, said).toContain(RECOVERY);

      // Nothing was written anywhere a build would find it.
      expect(existsSync(note), 'a refused run wrote a note').toBe(false);
    });
  }
});
