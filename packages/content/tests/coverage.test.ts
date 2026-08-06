import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// A plain module, shared with the scripts that use it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { checkCoverage, checkRegression, coverageOf, dimensionsIn } from '../../../scripts/lib/coverage.mjs';

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
 * These assert both rules against made-up datasets. Asserting the shipped
 * *counts* in `packages/content/data` would be a test that passes until the day
 * the data is wrong, which is the day it needs to fail.
 *
 * The grid at the bottom of this file does read that data, and only for the
 * *names* of the fields the generator writes — never for a number. The
 * difference is the whole of why it is allowed: a name read from the generator
 * is a subject the guard cannot shrink to fit, and reading the subject out of
 * the guard instead is exactly what let a build lose every word of text in all
 * 22 languages and be called no loss at all. See the note above `DIMENSIONS`.
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

  it('reads its plan counts out of a manifest, one number to a language', () => {
    // `coverageOf` answers the dataset audit, which compares this number with
    // the length of a file under `!==`. Widening it to the whole entry made all
    // 22 languages read "the manifest says [object Object] plans" — measured,
    // by running it. The guard's wider reading is `dimensionsIn`, below.
    const manifest = { coverage: { en: { plans: 72, rules: 7 }, ru: { plans: 70 } } };
    expect([...coverageOf(manifest)]).toEqual([
      ['en', 72],
      ['ru', 70],
    ]);
  });

  it('reads every dimension out of a manifest for the guard that needs them', () => {
    // `rules` was read out of the manifest and thrown away, though the
    // generator has always written it — and `withBody` was, for longer still.
    // That is the hole the grid at the bottom of this file exists for.
    //
    // The dimension names are deliberately not written down here. What is
    // asserted is the rule: whatever an entry states comes back unchanged,
    // anything else comes back as 0, and two entries answer the same set of
    // questions however differently they were written. Listing the names
    // instead is what let `withBody` sit in the manifest, uncompared, while
    // this very file claimed to read "every dimension".
    const coverage: Record<string, Record<string, number>> = {
      en: { plans: 72, rules: 7 },
      ru: { plans: 70 },
    };
    const read = dimensionsIn({ coverage });

    expect([...read.keys()]).toEqual(['en', 'ru']);
    for (const [language, entry] of read) {
      for (const [name, value] of Object.entries(entry as Record<string, number>)) {
        expect(value, `${language}.${name}`).toBe(coverage[language][name] ?? 0);
      }
    }
    const [en, ru] = [...read.values()].map((entry) => Object.keys(entry as object));
    expect(ru).toEqual(en);
  });

  it('reads a manifest written before a dimension existed as a zero, not a hole', () => {
    // An older manifest has no `rules` key at all. Zero is the floor that makes
    // the first build after the change impossible to call a regression, and
    // every build after that comparable.
    const [, entry] = [...dimensionsIn({ coverage: { ru: { plans: 72 } } })][0];
    expect(entry.rules).toBe(0);
  });

  it('treats a manifest with no coverage as covering nothing, rather than throwing', () => {
    // A malformed manifest is the shape of the accident, so it must produce
    // the finding rather than a stack trace three frames away from it.
    for (const manifest of [{}, null, undefined, { coverage: null }]) {
      expect(coverageOf(manifest).size).toBe(0);
      expect(dimensionsIn(manifest).size).toBe(0);
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

/**
 * The same rule, over the edge of every dimension the *generator* writes.
 *
 * The guard was written after a build emptied the dataset, and for a year it
 * compared plan counts and nothing else — though the thing that accident
 * destroyed *first* was `rules.json`, and though `build-content.mjs` has always
 * written `{ plans, rules, withBody }` into the manifest. A rebuild that found
 * all 72 plans in every language and not one rules chapter passed it.
 *
 * So this does not enumerate the dimensions by hand: naming them by hand is how
 * the first one came to be the only one.
 *
 * **Where they are read from, and why it moved.** They used to be read from
 * what `dimensionsIn` produced — from the guard. That is the same mistake the
 * top of `coverage.mjs` describes, committed by the file that exists to
 * describe it: *a check that reads its own subject out of the thing under test
 * cannot fail on an absence*. The guard tracked `plans` and `rules`; the
 * generator wrote `plans`, `rules` and `withBody`; and because this grid asked
 * the guard which dimensions existed, it walked two edges, agreed with itself,
 * and stayed green while a build that lost every word of text in all 22
 * languages was not a loss. Measured: `checkRegression` over the shipped
 * manifest with every `withBody` set to 0 returned no problems, where the same
 * experiment on `rules` returned 22.
 *
 * The dimensions therefore come from the other side now — the keys of the
 * coverage entries in `packages/content/data/manifest.json`, which is a file
 * `build-content.mjs` wrote. Only the *names* are read from it. Every number
 * below is still invented, because asserting the shipped counts would be a test
 * that passes until the day the data is wrong, which is the day it needs to
 * fail. A field the generator starts writing is walked here on the build after
 * it appears, and if the guard has not been told about it the grid goes red on
 * that field's row.
 *
 * Every dimension is given a different baseline, so a message quoting
 * `20 → 19` cannot be a message about the wrong dimension read as a pass.
 */
const MANIFEST = JSON.parse(
  readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8'),
) as { coverage?: Record<string, Record<string, number>> };

/** What the generator wrote, one entry to a language. The subject, not the check. */
const GENERATED = Object.values(MANIFEST.coverage ?? {});

const DIMENSIONS: string[] = [...new Set(GENERATED.flatMap((entry) => Object.keys(entry ?? {})))];

const BASELINE: Record<string, number> = Object.fromEntries(
  DIMENSIONS.map((name, i) => [name, 10 * (i + 1)]),
);

const around = (held: number) => [held - 1, 0, held, held + 1];

describe('a grid built from the edge of every dimension the generator writes', () => {
  it('has a generated dataset to take its dimensions from, and more than one', () => {
    // An empty or unreadable manifest would make every assertion below iterate
    // nothing and pass — the exact failure mode this whole file was written
    // about, one level up. So it is asserted before the grid runs.
    expect(GENERATED.length).toBeGreaterThan(0);
    expect(DIMENSIONS.length).toBeGreaterThan(1);
  });

  it('is compared against a guard that tracks every field the generator writes', () => {
    // The assertion that closes this class rather than this instance. The names
    // are read from the manifest and from `dimensionsIn`; neither side is
    // written down here, so the day `build-content.mjs` records a fourth number
    // and `TRACKED` does not, this fails and says which one.
    //
    // `dimensionsIn` returns exactly the tracked dimensions for any entry — a
    // missing one reads as 0 — so the keys of its output over the real manifest
    // are the guard's own list, obtained without exporting it.
    const tracked = Object.keys([...dimensionsIn(MANIFEST).values()][0] as object);
    const untracked = DIMENSIONS.filter((name) => !tracked.includes(name));

    expect(
      untracked,
      `written into the manifest by build-content.mjs and never compared by the guard: ${untracked.join(', ')}`,
    ).toEqual([]);
  });

  it('reports any strictly smaller value in any dimension, and names that dimension', () => {
    const before = new Map([['ru', { ...BASELINE }]]);

    for (const dimension of DIMENSIONS) {
      const held = BASELINE[dimension];
      for (const now of around(held)) {
        const where = `${dimension}: ${held} → ${now}`;
        const problems = checkRegression(before, new Map([['ru', { ...BASELINE, [dimension]: now }]]));

        if (now < held) {
          expect(problems, where).toHaveLength(1);
          expect(problems[0], where).toContain(dimension);
          expect(problems[0], where).toContain('ru');
          expect(problems[0], where).toContain(`${held} → ${now}`);
        }
        else {
          expect(problems, where).toEqual([]);
        }
      }
    }
  });

  it('is not talked out of a loss in one dimension by a gain in another', () => {
    // The exact shape of the hole: the plans all arrive, the rules book does
    // not. A guard that summed the dimensions, or that stopped at the first
    // one it liked, would call this build fine.
    const before = new Map([['ru', { ...BASELINE }]]);

    for (const lost of DIMENSIONS) {
      for (const gained of DIMENSIONS) {
        if (lost === gained) continue;
        const after = new Map([
          ['ru', { ...BASELINE, [lost]: 0, [gained]: BASELINE[gained] + 50 }],
        ]);
        const problems = checkRegression(before, after);
        expect(problems, `${lost} lost while ${gained} gained`).toHaveLength(1);
        expect(problems[0]).toContain(lost);
      }
    }
  });

  it('names every dimension that shrank, not the first one it found', () => {
    const before = new Map([['ru', { ...BASELINE }]]);
    const after = new Map([['ru', Object.fromEntries(DIMENSIONS.map((d) => [d, 0]))]]);

    const problems = checkRegression(before, after);
    expect(problems).toHaveLength(DIMENSIONS.length);
    for (const dimension of DIMENSIONS) {
      expect(problems.some((p: string) => p.includes(dimension)), dimension).toBe(true);
    }
  });

  it('reports a language that went away whatever its dimensions were', () => {
    // The other edge of the grid: not a smaller number, an absent row.
    for (const dimension of DIMENSIONS) {
      const before = new Map([['ru', { ...BASELINE, [dimension]: 0 }]]);
      const problems = checkRegression(before, new Map([['en', { ...BASELINE }]]));
      expect(problems, dimension).toHaveLength(1);
      expect(problems[0]).toContain('would be dropped');
    }
  });

  it('reads a bare count as plans, so a caller that counted them itself still works', () => {
    // `audit-dataset.mjs` and the older tests hand these functions plain
    // numbers. Making them throw would move this guard's own accident into the
    // check that was supposed to catch it.
    expect(checkRegression(counts({ ru: 72 }), counts({ ru: 40 }))[0]).toContain('plans');
    expect(checkRegression(counts({ ru: 72 }), new Map([['ru', { plans: 72, rules: 0 }]]))).toEqual(
      [],
    );
  });
});
