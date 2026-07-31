import { describe, expect, it } from 'vitest';
import { plansFor } from '../src';
import {
  CORRECTIONS,
  corrected,
  unappliedIn,
  // @ts-expect-error - the generator's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/corrections.mjs';

/**
 * A repair to the donor text, and where it has to live to survive.
 *
 * `9х280=7,380` is false in the plan whose whole argument is that nine keeps
 * its identity under multiplication. The English donor carries it, so the three
 * translations that follow the English rather than the Russian inherited it —
 * and a pass corrected all three in `packages/content/data/plans.*.json`, which
 * are generated files, and nowhere else.
 *
 * The next `node scripts/build-content.mjs` put the false sum back.
 * `audit-arithmetic` started failing, and the only reason anybody saw it was
 * that a rebuild happened to run in the same pass as the audit. **A repair that
 * lives in a generated file is a repair with a countdown on it**, and how long
 * it has is a matter of who rebuilds and when.
 *
 * So what is asserted here is the shape rather than the sum: a correction is
 * stated once, the generator applies it, and a correction that stops matching
 * says so instead of quietly doing nothing.
 */

type Correction = { where: string; languages: string[]; plan: number; from: string; to: string };
const stated = CORRECTIONS as Correction[];

describe('a correction is stated once and applied by the generator', () => {
  const fix = stated[0]!;

  it('rewrites the text it names', () => {
    const applied = corrected(`nine keeps itself: 9х280=${fix.from}=9.`, fix.languages[0], fix.plan);

    expect(applied.body).toContain(fix.to);
    expect(applied.body, 'and the donor’s form is gone').not.toContain(fix.from);
    expect(applied.applied).toEqual([fix.where]);
  });

  it('leaves a language it does not name alone', () => {
    // The Russian edition has always said 2520. Correcting a translation that
    // was never wrong is how a repair becomes damage of its own.
    const untouched = corrected(`9х280=${fix.from}=9`, 'ru', fix.plan);

    expect(untouched.body).toContain(fix.from);
    expect(untouched.applied).toEqual([]);
  });

  it('leaves every other plan alone', () => {
    // The same digits elsewhere are somebody else's sentence.
    const elsewhere = corrected(`9х280=${fix.from}=9`, fix.languages[0], fix.plan + 1);

    expect(elsewhere.body).toContain(fix.from);
    expect(elsewhere.applied).toEqual([]);
  });

  it('says so when it matches nothing at all', () => {
    // Either the donor was fixed upstream — good, and the entry should go — or
    // the sentence moved and the correction now describes text that is not
    // there. The two are indistinguishable to a build that stays quiet, so the
    // build fails instead.
    expect(unappliedIn([])).toEqual(stated.map((one) => one.where));
    expect(unappliedIn(stated.map((one) => one.where))).toEqual([]);
  });
});

describe('the shipped data carries every correction', () => {
  /**
   * The direction that can be checked without the donor repositories, which are
   * not in CI. Rebuilding to compare is what would catch a hand edit anywhere;
   * this catches one to the sentences somebody has already written down.
   */
  it('has the corrected form in the languages named, and not the donor’s', () => {
    for (const fix of stated) {
      for (const language of fix.languages) {
        const body = plansFor(language).find((plan) => plan.plan === fix.plan)?.body ?? '';

        expect(body, `${language}/${fix.plan}`).toContain(fix.to);
        expect(body, `${language}/${fix.plan}`).not.toContain(fix.from);
      }
    }
  });

  it('names only languages that exist and plans that exist', () => {
    // A correction pointing at a language nobody ships is a line that will
    // never apply and never be noticed, which is the failure it is meant to
    // prevent, one level up.
    for (const fix of stated) {
      for (const language of fix.languages) {
        expect(plansFor(language).length, language).toBeGreaterThan(0);
        expect(
          plansFor(language).some((plan) => plan.plan === fix.plan),
          `${language}/${fix.plan}`,
        ).toBe(true);
      }
    }
  });
});
