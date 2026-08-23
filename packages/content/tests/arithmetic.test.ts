import { beforeAll, describe, expect, it } from 'vitest';
import { plansFor } from '../src';
import {
  digitalRoot,
  equationsIn,
  factorisationsIn,
  falseClaimsIn,
  operatorlessIn,
  OPERATORLESS_RECORDED,
  keyOf,
  operatorlessClaimsIn,
  staleRecords,
  // @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/arithmetic.mjs';

/**
 * The reader behind `audit-arithmetic`, which had none of its own.
 *
 * It checks 466 sums across 22 languages and its header describes four false
 * alarms that had to be closed before any of them could be believed — and
 * nothing held it to a single one of those. A parser that quietly stopped
 * matching would report *"no sum is wrong"*, which is the same sentence it
 * prints when everything is right. That is the failure this repository has now
 * met in three different checks: **an absence reads exactly like a pass**.
 */

describe('what a sum reader must not be fooled by', () => {
  it('reads the digits of the script each language writes', () => {
    // Arabic, Urdu, Hindi and Marathi write their own numerals, and a reader
    // that only knows ASCII finds no arithmetic to check in four languages
    // while reporting them checked.
    expect(equationsIn('٨x٩=٧٢')).toEqual([
      { said: '8x9=72', left: 8, right: 9, product: 72, reduced: null },
    ]);
  });

  it('reads a grouped thousand as one number', () => {
    for (const written of ['3,384', '3 384', '3.384']) {
      expect(equationsIn(`9x376=${written}`)[0]?.product, written).toBe(3384);
    }
  });

  it('checks where a chain lands and not how it gets there', () => {
    // Ukrainian writes plan 8's steps as `8х2=16= 1 +6 =7`, spaces and all, and
    // reading the middle reported six false alarms in three languages. The end
    // of a chain is unambiguous; the middle is typography.
    const [chain] = equationsIn('8х2=16= 1 +6 =7');

    expect(chain.product).toBe(16);
    expect(chain.reduced, 'the digit it comes down to').toBe(7);
    expect(falseClaimsIn([{ plan: 8, body: '8х2=16= 1 +6 =7' }])).toEqual([]);
  });

  it('claims no reduction where the text states none', () => {
    expect(equationsIn('9x8=72')[0]?.reduced).toBe(null);
    expect(equationsIn('9x2=18=9')[0]?.reduced).toBe(9);
  });

  it('reads a total explained by its factors, which come after it', () => {
    // `900 breaths (60 х 15)` — the other shape, and the multiplication reader
    // never saw it because the answer is on the left.
    expect(factorisationsIn('900 breaths (60 х 15)')).toEqual([
      { said: '900 breaths (60 х 15)', left: 60, right: 15, product: 900, reduced: null },
    ]);
  });

  it('says a false product is false and a true one is not', () => {
    expect(falseClaimsIn([{ plan: 9, body: '9х280=7,380' }])[0]?.faults).toEqual([
      '9 × 280 is 2520',
    ]);
    expect(falseClaimsIn([{ plan: 9, body: '9х280=2,520' }])).toEqual([]);
  });

  it('knows what reducing to a single digit means', () => {
    for (const [value, root] of [
      [72, 9],
      [80, 8],
      [2520, 9],
      [9, 9],
      [0, 0],
    ] as Array<[number, number]>) {
      expect(digitalRoot(value), String(value)).toBe(root);
    }
  });
});

describe('a sum whose operator is gone', () => {
  /**
   * Every reader above finds a sum **by its multiplication sign**, so a sum
   * whose sign the translation ate is not a sum to any of them — and it is not
   * a missing sum either. It reads as prose with some numbers in it, and the
   * check was blind in exactly the place the damage was.
   *
   * Plan 8's run ends in a sentence rather than in the list, and that is where
   * two languages lost the sign: Malay wrote `8 9 = 72`, Arabic `8 9 9 = 72`.
   * The shape is a run of two or more numbers separated by nothing but space,
   * on the left of an `=`. A left side is one number or an expression; two
   * numbers side by side is not arithmetic in any notation.
   */
  it('finds a left side that is two numbers with nothing between them', () => {
    expect(operatorlessIn('dengan itu 8 9 = 72-ia menjadi')).toEqual(['8 9 = 72']);
    expect(operatorlessIn('حالته الأصلية ، 81 10 = 80 = 8. هذه')).toEqual(['81 10 = 80 = 8']);
  });

  it('says nothing about a sum that has its operator', () => {
    for (const sound of ['8х9 = 72', '8x9=72, 7+2=9', '900 breaths (60 х 15)', '9х280=2,520=9']) {
      expect(operatorlessIn(sound), sound).toEqual([]);
    }
  });

  it('says nothing about numbers that are not a claim', () => {
    // Board references and dates sit next to each other all through the text.
    // The rule needs the `=`, or every list of squares becomes a broken sum.
    for (const prose of [
      'see boxes 38, 39, and 40',
      'the 72 000 nadis of the body',
      'plans 1 2 3 in a row',
    ]) {
      expect(operatorlessIn(prose), prose).toEqual([]);
    }
  });

  it('reads the numerals of any script, like everything else here', () => {
    expect(operatorlessIn('٨ ٩ = ٧٢')).toEqual(['8 9 = 72']);
  });

  it('carries the whole claim rather than the fragment before the first =', () => {
    // `8 80 =` reads as a truncation of the check's own making; `8 80 = 80 = 8`
    // reads as damage, which is what it is.
    expect(operatorlessIn('asalnya, 8 80 = 80 = 8. Fenomena')).toEqual(['8 80 = 80 = 8']);
  });
});

describe('the shipped text, held to what the audit records', () => {
  const bodyOf = (language: string, plan: number) =>
    plansFor(language).find((entry) => entry.plan === plan)?.body ?? '';

  // What is asserted here is the shape of the record, not its contents. Naming
  // the three lines again would put the same list in a second place, and the
  // day one of them is repaired the two disagree — with the test failing on a
  // string comparison that says nothing about why.
  const foundNow = () =>
    ['ms', 'ar', 'uk', 'en', 'ru'].flatMap((language) =>
      operatorlessClaimsIn(
        plansFor(language).map((plan) => ({ plan: plan.plan, body: plan.body })),
      ).map((claim: { plan: number; said: string }) => keyOf(language, claim)),
    );

  it('grants no excuse for a defect that is gone', () => {
    // A record excuses a sum the audit would otherwise fail on. Once the sum is
    // repaired the excuse is still granted, and the next one that reads the
    // same way passes on a licence issued for something else. Repairing a
    // recorded sum must therefore fail the audit until the record goes with it.
    expect(staleRecords(OPERATORLESS_RECORDED, foundNow())).toEqual([]);
  });

  it('records every operator-less sum the shipped text carries', () => {
    // The other direction, and a separate question: an unrecorded defect is
    // work for a translator, a stale record is work for whoever keeps the list.
    // One comparison answering both is how somebody is sent to fix the wrong
    // thing.
    expect(foundNow().filter((line: string) => !OPERATORLESS_RECORDED.includes(line))).toEqual([]);
  });

  it('sees a record go stale, which is the whole point of asking', () => {
    // The check proved against a case it can actually be wrong about: a green
    // result from a list nobody could falsify is the absence this file exists
    // to distinguish from a pass.
    expect(staleRecords(['ms/8: 8 80 = 80 = 8'], ['ms/8: 8 80 = 80 = 8'])).toEqual([]);
    expect(staleRecords(['ms/8: 8 80 = 80 = 8'], ['ms/8: 8x10 = 80 = 8'])).toEqual([
      'ms/8: 8 80 = 80 = 8',
    ]);
    expect(staleRecords(['ms/8: 8 80 = 80 = 8'], [])).toEqual(['ms/8: 8 80 = 80 = 8']);
  });

  it('reads the sum that was repaired, and finds it true', () => {
    // `8 9 = 72` was not checked by anything while its sign was missing.
    // Putting the sign back is what brought it under the audit at all.
    const restored = equationsIn(bodyOf('ms', 8)).filter(
      (sum: { left: number; right: number }) => sum.left === 8 && sum.right === 9,
    );

    expect(restored, 'the sentence states 8 × 9').toHaveLength(1);
    expect(falseClaimsIn([{ plan: 8, body: bodyOf('ms', 8) }])).toEqual([]);
  });

  it('every sum in every language is true', () => {
    // The audit's whole claim, asserted here rather than only printed there.
    for (const language of ['en', 'ru', 'uk', 'ms', 'ar', 'hi', 'zh']) {
      expect(
        falseClaimsIn(plansFor(language).map((plan) => ({ plan: plan.plan, body: plan.body }))),
        language,
      ).toEqual([]);
    }
  });
});
import { loadEveryLanguage } from '../src/index';

/**
 * Every language's text, in memory, before anything asks for it.
 *
 * Twenty-one of the twenty-two are loaded on demand now — the board's entry
 * carried 6.6 MB of plan text to a reader of one language, and only English is
 * static because it is the fallback. A suite that reads other languages has to
 * say so, and this is that saying: without it these tests would quietly
 * measure English twenty-two times and pass.
 */
beforeAll(loadEveryLanguage);

