import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The audits' own blanker, so prose is read as prose here the way it is there.
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * A record that names a file, and whether the file is there.
 *
 * The third instance of one shape, found in one night: naming a thing counted
 * as checking it. `scripts/audit-doubles.mjs` declared
 * `TIED = new Map([['TOTAL_PLANS', 'packages/journal/tests/board-size.test.ts']])`
 * under a comment saying *an entry here is a promise that something else is
 * watching* — and the promise was never opened. `staleAmong` was handed the
 * KEYS, so the question asked was whether anything still declares `TOTAL_PLANS`
 * twice; the VALUE, which is the whole of the promise, was read twice and both
 * times to print it. Delete the test it names and the audit went on printing
 * *`...` holds them in step* and exiting 0.
 *
 * That entry is now checked where it is declared. This is the other half, and
 * it is the half that matters for the entry nobody has written yet: the same
 * mistake is one line of a new list away, in any of the twenty-odd audits, and
 * the audit that makes it will read exactly like an audit that passes.
 *
 * So the assertion is the SHAPE over the whole of `scripts/audit-*.mjs`, and no
 * path is named here. Whatever an audit writes down as a repository-relative
 * path, that path is a file that exists. `TOTAL_PLANS` is not hard-coded, and
 * removing `TIED` entirely would not make this test pass over nothing — the
 * guards below fail if the sweep stops finding paths, or stops finding them in
 * more than one audit.
 *
 * **What this does not cover, said out loud.** `scripts/lib/*.mjs` is outside
 * the sweep, and `lib/records.mjs` is the one module there that holds paths in
 * quantity — every `askedIn` and every `namesIn` in `DECLARED`. Those two are
 * already read by `unasked` and `stalePermissions` and asserted over by
 * `packages/content/tests/records.test.ts`, which is why the gap is a gap and
 * not a hole. An audit's own lists had nothing of the kind.
 *
 * **And why a path is parsed rather than grepped.** `scripts/audit-variants.mjs`
 * is written almost entirely out of paths — `leela/src/store/DiceStore.ts`,
 * `leela/src/screens/helper.ts` — into the DONOR clones, which are not in this
 * repository at all and are absent from CI by design. A line search for
 * something that looks like a path would report every one of them as missing on
 * the first run, and a check that cries wolf on correct code is one somebody
 * deletes rather than obeys. A path is taken to be repository-relative only when
 * its first segment is a directory that this repository actually has at its
 * root, read off the tree rather than listed here.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The directories this repository has at its root.
 *
 * Read rather than written down, for the reason every list in `scripts/` is
 * found rather than listed: a hand-kept copy of the workspace layout is the
 * sixth such list here to be wrong by omission. A workspace added tomorrow is a
 * root this sweep already knows about.
 */
const rootDirectories = (): string[] =>
  readdirSync(REPO, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !['node_modules', 'dist', 'coverage', '.git', '.worktrees'].includes(entry.name))
    .map((entry) => entry.name);

const ROOTS = rootDirectories();

/**
 * Every repository-relative path written as a literal in one module's code.
 *
 * Three things make a literal a path here, and each of the three was put in to
 * stop the check accusing something correct:
 *
 * - it carries a separator and ends in an extension, so `'packages'` and
 *   `'staleAmong'` are not paths;
 * - its first segment is a directory this repository has, so the donor paths in
 *   `audit-variants.mjs` and `audit-copies.mjs` — `leela/src/store/helper.ts`,
 *   which lives in `../leela-src` and is absent from CI — are not ours to
 *   resolve and are not claimed to be;
 * - it is read out of `blank(source)`, so a path quoted in a doc-comment
 *   explaining what a file used to be called is not read as a live claim.
 *
 * That last one is the rule this repository has now learned four times, and it
 * is the one that would have made this check useless rather than merely noisy:
 * every audit here documents the defect it closed, in prose, quoting paths.
 */
const pathsIn = (source: string): string[] => {
  const found = new Set<string>();
  const literal = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n$\\]*)`/g;

  for (const match of blank(source).matchAll(literal)) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    if (!text.includes('/') || !/\.[A-Za-z0-9]{1,5}$/.test(text)) continue;
    if (!ROOTS.includes(text.split('/')[0])) continue;
    found.add(text);
  }

  return [...found].sort();
};

/** The audits, by walking `scripts/` rather than by naming them. */
const audits = (): string[] =>
  readdirSync(join(REPO, 'scripts'))
    .filter((name) => /^audit-.+\.mjs$/.test(name))
    .sort();

describe('reading a path out of a declaration', () => {
  /**
   * Whatever form the list is written in, and whatever quote holds the path.
   *
   * A grid rather than a sample, for the reason `records.test.ts` gives about
   * the same question one level up: this repository's rule for FINDING a list
   * was widened twice to fit whichever list somebody had just found, and stayed
   * blind to `new Set(` through five audits while a test of it passed. A form
   * added tomorrow is a row here.
   */
  const FORMS = {
    map: (path: string, quote: string) =>
      `const TIED = new Map([['NAME', ${quote}${path}${quote}]]);`,
    array: (path: string, quote: string) => `const WATCHED = [${quote}${path}${quote}];`,
    object: (path: string, quote: string) => `const DOCS = { name: ${quote}${path}${quote} };`,
    set: (path: string, quote: string) => `const SEEN = new Set([${quote}${path}${quote}]);`,
    wrapped: (path: string, quote: string) =>
      `const DOCS = [\n  // a note between two entries\n  ${quote}${path}${quote},\n];`,
  };

  const QUOTES = { single: "'", double: '"', backtick: '`' };

  for (const [form, write] of Object.entries(FORMS)) {
    for (const [named, quote] of Object.entries(QUOTES)) {
      it(`finds the path in a ${form} written with a ${named} quote`, () => {
        expect(pathsIn(write('packages/journal/src/index.ts', quote))).toEqual([
          'packages/journal/src/index.ts',
        ]);
      });
    }
  }

  it('does not read a path out of prose about one', () => {
    // Every audit here documents the defect it closed, and quotes paths doing
    // it. A file explaining that a check used to look at
    // `packages/engine/src/gone.ts` is not a file claiming that file is there.
    const source = [
      "/** This once read 'packages/engine/src/gone.ts', and no longer does. */",
      "// and again in a line comment: 'apps/bot/src/gone.ts'",
      "const KEPT = ['packages/engine/src/index.ts'];",
    ].join('\n');

    expect(pathsIn(source)).toEqual(['packages/engine/src/index.ts']);
  });

  it('does not claim a donor path, which belongs to a tree this repository has not got', () => {
    // The measured false alarm. `audit-variants.mjs` is written out of these,
    // and CI does not check the donors out at all.
    const source = [
      "const CLAIMS = [{ file: 'leela/src/store/DiceStore.ts' }];",
      "const ALSO = ['NeuroLeelaExpo/services/GameService.ts'];",
    ].join('\n');

    expect(pathsIn(source)).toEqual([]);
  });

  it('does not take a name, a directory or a bare word for a path', () => {
    const source = [
      "const ASKS = ['staleAmong'];",
      "const WHERE = ['packages'];",
      "const ROOT = ['packages/journal'];",
      "const KIND = ['record'];",
    ].join('\n');

    expect(pathsIn(source)).toEqual([]);
  });
});

/** The real text of one audit. */
const textOf = (audit: string): string => readFileSync(join(REPO, 'scripts', audit), 'utf8');

/**
 * Paths the audits name that are not there, over a given reading of the audits.
 *
 * Injected rather than reading the tree directly, so the same question can be
 * put to a mutant. A check proved only against the repository as it stands is a
 * check that has never been seen to fail.
 */
const missingIn = (sourceOf: (audit: string) => string): string[] => {
  const missing: string[] = [];

  for (const audit of audits()) {
    for (const path of pathsIn(sourceOf(audit))) {
      if (!existsSync(join(REPO, path))) missing.push(`scripts/${audit}  ${path}`);
    }
  }

  return missing;
};

/** Every (audit, path) the sweep can see today, which is what the grid runs over. */
const named = audits().flatMap((audit) => pathsIn(textOf(audit)).map((path) => ({ audit, path })));

describe('an audit that names a file', () => {
  it('is found at all, and in more than one of them, or the sweep proves nothing', () => {
    // Without this the assertion below passes over an empty list, which is the
    // exact state — a check reporting success having looked at nothing — that
    // the three findings this file belongs to are all instances of.
    expect(audits().length).toBeGreaterThan(10);
    expect(named.length).toBeGreaterThan(4);
    expect(new Set(named.map((one) => one.audit)).size).toBeGreaterThan(2);
  });

  it('names a file that is there', () => {
    /**
     * The shape. An audit writing down a repository-relative path is an audit
     * asserting something about that file — that it holds a rule in step, that
     * it documents a command, that it is where a permission's names live. A
     * path that resolves to nothing asserts nothing, and says so to nobody.
     */
    expect(missingIn(textOf)).toEqual([]);
  });

  /**
   * The same question put to every path in turn, one letter off.
   *
   * This is the falsification kept rather than run once and written up. The
   * failure it models is the one that nearly passes and is therefore the one
   * that happens: a test renamed from `.test.ts` to `.test.tsx`, a module moved
   * one directory over, an entry copied with a typo. For each path the audit's
   * text is rewritten in memory with that path lengthened by a character, and
   * the sweep must report exactly that one and nothing else — not "at least
   * one", which would also be satisfied by the sweep having broken and reported
   * every path in the repository.
   *
   * Nothing is written to disk. A check that edits `scripts/` to prove a point
   * leaves the edit behind when it is killed, which this repository has already
   * paid for once in `audit-mutants`.
   */
  for (const { audit, path } of named) {
    it(`is caught when scripts/${audit} names ${path} one letter off`, () => {
      const mutant = (which: string) =>
        which === audit ? textOf(which).split(path).join(`${path}x`) : textOf(which);

      expect(existsSync(join(REPO, `${path}x`)), `${path}x is a real file`).toBe(false);
      expect(missingIn(mutant)).toEqual([`scripts/${audit}  ${path}x`]);
    });
  }
});
