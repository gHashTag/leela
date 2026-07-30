import { describe, expect, it } from 'vitest';
// A plain module, shared with the scripts that use it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { checkCoverage, checkRegression, coverageOf } from '../../../scripts/lib/coverage.mjs';

/**
 * Whether the generated dataset still covers what the package promises.
 *
 * This happened, to this repository, while checking something else:
 * `build-content.mjs` was run with a source directory that did not exist. It
 * found nothing, wrote an empty `rules.json` and an empty manifest, exited 0,
 * and printed "Content built". Twenty-four tests in `@leela/content` went red
 * for a reason none of them named.
 *
 * Two silences made it possible. The generator did not know what it was
 * replacing, so losing 22 languages looked the same as building the first one.
 * And CI's dataset check iterated *the languages the manifest listed* — so an
 * empty manifest was zero iterations and a green job.
 *
 * These assert both rules against made-up datasets. Asserting against
 * `packages/content/data` would be a test that passes until the day the data is
 * wrong, which is the day it needs to fail.
 */

const DECLARED = ['en', 'ru', 'zh'];
const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('the dataset against the languages the package declares', () => {
  it('is quiet when every declared language is complete', () => {
    expect(checkCoverage(DECLARED, counts({ en: 72, ru: 72, zh: 72 }), 72)).toEqual([]);
  });

  it('fails on an empty dataset, which is the case that was passing', () => {
    // The whole reason this file exists. A check that reads its subject out of
    // the thing under test cannot fail on an absence: iterating the manifest's
    // own language list means an empty manifest is a green run.
    const problems = checkCoverage(DECLARED, counts({}), 72);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no languages at all');
  });

  it('names a declared language the data does not have', () => {
    const problems = checkCoverage(DECLARED, counts({ en: 72, ru: 72 }), 72);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('zh');
    expect(problems[0]).toContain('absent');
  });

  it('names a language with the wrong number of plans, in both directions', () => {
    const short = checkCoverage(DECLARED, counts({ en: 71, ru: 72, zh: 72 }), 72);
    const long = checkCoverage(DECLARED, counts({ en: 73, ru: 72, zh: 72 }), 72);
    expect(short[0]).toContain('71 plans');
    expect(long[0]).toContain('73 plans');
  });

  it('names a language in the data that nothing declares', () => {
    // The other direction: a locale the generator picked up and the package
    // does not serve is a file nobody reads and a promise nobody made.
    const problems = checkCoverage(DECLARED, counts({ en: 72, ru: 72, zh: 72, xx: 72 }), 72);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not in LANGUAGES');
  });

  it('reads its counts out of a manifest', () => {
    const manifest = { coverage: { en: { plans: 72, rules: 7 }, ru: { plans: 70 } } };
    expect([...coverageOf(manifest)]).toEqual([
      ['en', 72],
      ['ru', 70],
    ]);
  });

  it('treats a manifest with no coverage as covering nothing, rather than throwing', () => {
    // A malformed manifest is the shape of the accident, so it must produce
    // the finding rather than a stack trace three frames away from it.
    for (const manifest of [{}, null, undefined, { coverage: null }]) {
      expect(coverageOf(manifest).size).toBe(0);
    }
  });
});

describe('what a rebuild would take away', () => {
  it('refuses a build that found nothing where the dataset has everything', () => {
    const problems = checkRegression(counts({ en: 72, ru: 72 }), counts({}));
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('would be dropped');
  });

  it('refuses a build that found fewer plans than are already there', () => {
    const problems = checkRegression(counts({ en: 72 }), counts({ en: 40 }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('72 → 40');
  });

  it('allows a build that gains, because that is the generator working', () => {
    // A new language, or one that gained the plans it was missing, is not a
    // regression. A guard that fires on both is a guard people pass --force to
    // by habit, which is no guard.
    expect(checkRegression(counts({ en: 72 }), counts({ en: 72, ru: 72 }))).toEqual([]);
    expect(checkRegression(counts({ ru: 70 }), counts({ ru: 72 }))).toEqual([]);
  });

  it('allows the first build of all, when there is nothing to lose', () => {
    expect(checkRegression(new Map(), counts({ en: 72 }))).toEqual([]);
  });
});
