import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as group, expect, it } from 'vitest';

import { blank, sourceFilesUnder } from '../../../scripts/lib/source.mjs';
import { DECLARED, wallClockBounds } from '../../../scripts/lib/timing.mjs';

/**
 * A test may not put a ceiling on wall-clock time without saying why.
 *
 * `audit-timing.mjs` is the gate; this is the check on the gate. Three flakes
 * in this repository were one shape — an assertion that something finished
 * inside N milliseconds — and **each was repaired by raising N**, which is the
 * move #46–#49 already recorded as wrong: a measurement taken to explain a load
 * problem is subject to the load.
 *
 * The asymmetry is the rule. A CEILING is falsified by a busy machine. A FLOOR
 * — *it waited at least N* — a busy machine only makes more true, so it cannot
 * flake that way and is never required to be declared.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/*
 * The matcher is split in every fixture below, and that is not affectation.
 * This file's own examples are read by the sweep at the bottom — `blank` keeps
 * string contents on purpose, because a check that forbids a sentence has to be
 * able to see the sentence — so a fixture written whole is indistinguishable
 * from the assertion it describes, and **this file failed its own rule the
 * first time it ran.** Splitting the name says *quoted, not asserted*, which is
 * the same device `one-set-of-flags.test.ts` uses to write a glob that its own
 * blanker must not eat.
 */
const CEILING = 'toBeLess' + 'Than';
const CEILING_OR_EQUAL = 'toBeLess' + 'ThanOrEqual';

group('a ceiling on the clock, told from a floor', () => {
  it('CATCHES the shape that flaked three times', () => {
    const found = wallClockBounds(`expect(Date.now() - began).${CEILING}(1_000)`);

    expect(found).toHaveLength(1);
    expect(found[0].upper).toBe(true);
  });

  it('DOES NOT COUNT A FLOOR, which load can only make more true', () => {
    /*
     * The half that decides whether this rule is worth keeping. `waiting.test.ts`
     * asserts that `until` waited AT LEAST as long as it was given, and a loaded
     * machine makes that assertion pass harder. Requiring it to be declared
     * would be a check crying wolf on a correct test.
     */
    const floor = wallClockBounds('expect(Date.now() - began).toBeGreaterThanOrEqual(120)');

    expect(floor).toHaveLength(1);
    expect(floor[0].upper).toBe(false);
  });

  it('reads performance.now as well, and both matchers of each kind', () => {
    expect(wallClockBounds(`expect(performance.now() - t).${CEILING_OR_EQUAL}(5)`)[0].upper).toBe(true);
    expect(wallClockBounds('expect(Date.now() - t).toBeGreaterThan(5)')[0].upper).toBe(false);
  });

  it('leaves alone a clock read that bounds nothing', () => {
    // A test may take the time without asserting on it — `kept.test.ts` passed
    // `Date.now()` into the engine for years. A reader that called those bounds
    // would be switched off.
    expect(wallClockBounds('advance(session, roll, Date.now())')).toEqual([]);
    expect(wallClockBounds('const began = Date.now()')).toEqual([]);
    expect(wallClockBounds(`expect(plan).${CEILING}(72)`)).toEqual([]);
  });

  it('leaves alone a DIFFERENCE that nothing asserts on', () => {
    /*
     * The case the three above do not reach, and falsification is how I know:
     * none of them contains a clock DIFFERENCE, so all three are refused before
     * the matcher is ever consulted — and deleting the matcher check left every
     * assertion in this file green. A test may measure a duration and log it,
     * or hand it to a helper, without bounding it.
     */
    expect(wallClockBounds('const took = Date.now() - began;')).toEqual([]);
    expect(wallClockBounds('log(`${Date.now() - began}ms`)')).toEqual([]);
  });

  it('reads a statement, not a line, because the formatter breaks them', () => {
    // An assertion wrapped over three lines is one bound; a line-by-line reader
    // finds the clock on one and the matcher on another and reports neither.
    const wrapped = `expect(\n  Date.now() - began,\n  "took too long",\n).${CEILING}(1_000)`;

    expect(wallClockBounds(wrapped)).toHaveLength(1);
    expect(wallClockBounds(wrapped)[0].upper).toBe(true);
  });

  it('answers for nothing without throwing', () => {
    expect(wallClockBounds('')).toEqual([]);
    expect(wallClockBounds(null)).toEqual([]);
    expect(wallClockBounds(undefined)).toEqual([]);
  });
});

group('the repository as it stands', () => {
  const ceilings = new Map<string, number>();

  for (const file of ['apps', 'packages'].flatMap((group_) => sourceFilesUnder(join(ROOT, group_)) as string[])) {
    if (file.includes('node_modules') || !file.endsWith('.test.ts')) continue;
    const upper = wallClockBounds(blank(readFileSync(file, 'utf8'))).filter((one: { upper: boolean }) => one.upper);
    if (upper.length > 0) ceilings.set(relative(ROOT, file), upper.length);
  }

  it('has test files to read', () => {
    // Every check that walks a tree can walk an empty one and pass over
    // nothing. This has happened twice in this repository.
    const all = ['apps', 'packages']
      .flatMap((group_) => sourceFilesUnder(join(ROOT, group_)) as string[])
      .filter((file) => !file.includes('node_modules') && file.endsWith('.test.ts'));

    expect(all.length).toBeGreaterThan(200);
  });

  it('DECLARES EVERY CEILING, and declares no file that has stopped having one', () => {
    /*
     * Both halves, because an excuse list rots in two directions: a new ceiling
     * arriving undeclared, and an entry outliving the thing it excused. The
     * second is what `lib/records.mjs` was written about.
     */
    expect(
      [...ceilings.keys()].filter((file) => !DECLARED.some((one: { file: string }) => one.file === file)),
      'a ceiling on wall-clock time that nothing accounts for',
    ).toEqual([]);

    expect(
      DECLARED.filter((one: { file: string }) => !ceilings.has(one.file)).map((one: { file: string }) => one.file),
      'declared, and no longer has a ceiling',
    ).toEqual([]);
  });

  it('counts them, so a file cannot grow a second one quietly', () => {
    for (const one of DECLARED as ReadonlyArray<{ file: string; bounds: number }>) {
      expect(ceilings.get(one.file), `${one.file} declared ${one.bounds}`).toBe(one.bounds);
    }
  });

  it('says why for each, in more than a word', () => {
    for (const one of DECLARED as ReadonlyArray<{ file: string; because: string }>) {
      expect(one.because.length, `${one.file} needs a reason`).toBeGreaterThan(40);
    }
  });
});
