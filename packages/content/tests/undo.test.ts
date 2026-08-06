import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
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
 * `putItBack` is the one that matters, because `bun scripts/audit-mutants.mjs`
 * is the command every message in this repository prints when the tree is
 * broken — so the recovery died on precisely the input that the doc-comment
 * beside it already called the likeliest one.
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
 */
describe('every note a process killed mid-write can leave', () => {
  const path = join(room, 'grid-subject.ts');
  const ORIGINAL = 'export const answer = 41;\n';
  const MUTATED = 'export const answer = 0;\n';

  /** Exactly what `remember` puts on disk, so the prefixes are the real ones. */
  const serialised = JSON.stringify({ path, original: ORIGINAL });

  const prefixes = Array.from({ length: serialised.length + 1 }, (_, n) => ({
    why: `prefix of ${n}/${serialised.length} bytes`,
    text: serialised.slice(0, n),
  }));

  // Notes that parse but are not notes. A truncated write can land on valid
  // JSON — `{"path":null}` is a few keystrokes from one — and `writeFileSync`
  // given a number for a path throws exactly as loudly as `JSON.parse` did.
  const wrongShape = [
    { why: 'path is a number', text: JSON.stringify({ path: 42, original: ORIGINAL }) },
    { why: 'path is null', text: JSON.stringify({ path: null, original: ORIGINAL }) },
    { why: 'path is an object', text: JSON.stringify({ path: { p: path }, original: '' }) },
    { why: 'path is missing', text: JSON.stringify({ original: ORIGINAL }) },
    { why: 'original is a number', text: JSON.stringify({ path, original: 7 }) },
    { why: 'original is missing', text: JSON.stringify({ path }) },
    { why: 'the note is an array', text: JSON.stringify([path, ORIGINAL]) },
    { why: 'the note is a bare null', text: 'null' },
    { why: 'the note is not JSON at all', text: 'not json at all' },
    { why: 'the note is a log line', text: 'Killed: 9\n' },
  ];

  for (const { why, text } of [...prefixes, ...wrongShape]) {
    it(`answers rather than throwing — ${why}`, () => {
      const note = join(room, `grid-${why.replace(/\W+/g, '-')}.json`);
      writeFileSync(path, MUTATED);
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
        expect(readFileSync(path, 'utf8'), 'and the broken file was left alone').toBe(MUTATED);
      } else {
        // The only readable note in the grid is the whole string.
        expect(text).toBe(serialised);
        expect(back.restored).toBe(path);
        expect(back.recovery).toBeNull();
        expect(readFileSync(path, 'utf8')).toBe(ORIGINAL);
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
      writeFileSync(path, MUTATED);
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

  it('has a grid wide enough to contain a truncated write at all', () => {
    // Guards the guard: if `remember` ever wrote something short, the loop
    // above would still pass while covering almost nothing.
    expect(serialised.length).toBeGreaterThan(40);
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

    // Blanked, under the repository-wide rule in `apps/mobile/tests/source.test.ts`
    // that a claim about source text is made about code. It is not decoration
    // here: MEASURED, `--restore` appears three times in that script and only
    // one of them is code — the usage block at the top and the paragraph above
    // the parse are the other two. A check reaching for the bare flag would
    // pass on a script that documents a flag it never looks at. The needle
    // below is the call itself, and it survives blanking because `blank` erases
    // comments and leaves string contents alone, which was measured too rather
    // than read off the doc-comment.
    const source = blank(readFileSync(join(ROOT, 'scripts', 'audit-mutants.mjs'), 'utf8'));
    expect(source).toContain("args.includes('--restore')");
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
