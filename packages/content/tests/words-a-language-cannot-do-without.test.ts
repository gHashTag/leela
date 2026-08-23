/**
 * Reading a Latin-script translation without reading its meaning.
 *
 * `lib/untranslated.mjs` asks whether a paragraph is written in the language it
 * is filed under by looking at the script, and said so about its own hole: *for
 * the languages written in the Latin script there is no test of this kind — an
 * English title left in German has every letter a German title has.* Two of the
 * twenty-two were read by nothing at all, and the count of what had been checked
 * was printed beside the count of what had not.
 *
 * The closed class answers it a different way. A language cannot write a
 * paragraph of prose without its articles, conjunctions and prepositions, and
 * that part of a language says nothing about meaning — so asking whether a
 * German paragraph holds `der`, `und` or `ist` overrules no translator, which
 * is the line `lib/corrections.mjs` draws.
 *
 * These assert the instrument rather than the dataset: that it fires on prose
 * in the wrong language, that it does not fire on prose in the right one, and
 * that the bound it is used at is the bound it was measured at. The dataset is
 * clean today; the check is what a donor update would have to get past.
 */

import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { FUNCTION_WORDS, unseeableIn, wrongLanguageIn } from '../../../scripts/lib/untranslated.mjs';
import { LANGUAGES, plansFor, scriptOf, type Language, loadEveryLanguage } from '../src/index';

const words = FUNCTION_WORDS as Record<string, RegExp>;
const covered = Object.keys(words);

/** A language's plans in the shape the audit reads them. */
const plansOf = (language: string) =>
  plansFor(language as Language).map((plan) => ({ plan: plan.plan, title: plan.title, body: plan.body }));

/** English prose, long enough to be judged, filed under another language. */
const englishProse = () =>
  plansFor('en')
    .flatMap((plan) => String(plan.body ?? '').split('\n\n'))
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.split(/\s+/).length >= 25 && !/^\d/.test(paragraph));

describe('the words a language cannot do without', () => {
  it('finds nothing in the language they belong to', () => {
    // The half that matters most: a check that accuses a translator wrongly is
    // worse than no check, because somebody would act on it.
    const accused = covered.flatMap((language) =>
      (LANGUAGES as readonly string[]).includes(language)
        ? wrongLanguageIn(plansOf(language), language)
        : [],
    );

    expect(accused).toEqual([]);
  });

  it('finds English prose filed under every one of them', () => {
    // The other half. Stated as a proportion rather than as every paragraph:
    // one of the three hundred and forty-one is missed by all seven, and a rule
    // that never missed would be one that accuses.
    const english = englishProse();

    for (const language of covered) {
      if (language === 'en') continue;

      const asIfTheirs = english.map((paragraph, at) => ({ plan: at + 1, title: '', body: paragraph }));
      const caught = wrongLanguageIn(asIfTheirs, language).length;

      expect({ language, most: caught > english.length * 0.9 }).toEqual({ language, most: true });
    }
  });

  it('judges nothing shorter than the length it was measured at', () => {
    // Written first with a letter count alone, it called two Javanese
    // paragraphs of fourteen words foreign. They are Javanese, and short enough
    // to hold none of the fifteen words listed for it. A rule may only be used
    // at the bound it was measured at.
    const short = 'Nganti pemain tekan chakra papat, Dharma tetep kanggo dheweke mung istilah tanpa makna.';

    expect(short.split(/\s+/).length).toBeLessThan(25);
    expect(wrongLanguageIn([{ plan: 1, title: '', body: short }], 'jv')).toEqual([]);
  });

  it('judges nothing that is mostly numbers', () => {
    // The board's own grid is a paragraph by length and holds no words in any
    // language, because it holds almost none.
    const grid = Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 9 }, (_, column) => 72 - row * 9 - column).join(' '),
    ).join('\n');

    expect(wrongLanguageIn([{ plan: 1, title: '', body: grid }], 'de')).toEqual([]);
  });

  it('leaves out the language a word list is the wrong instrument for', () => {
    // Turkish is agglutinative: `bu` arrives as `bundan`, `kendi` as `kendisi`,
    // and a word-boundary match finds neither. One real Turkish paragraph of
    // three hundred and ninety-seven holds none of sixteen ordinary function
    // words, and adding one until it passes would be fitting the rule to the
    // sample. It stays unread, and the audit says which languages those are.
    expect(words.tr).toBeUndefined();
    expect(unseeableIn([...LANGUAGES], scriptOf).filter((language: string) => language === 'tr')).toEqual(['tr']);
  });

  /**
   * The shape, not the one language this test used to name.
   *
   * `unseeableIn` filtered on the word list alone while its own comment promised
   * *Latin script and no words listed*, so it counted the fourteen languages the
   * script test reads perfectly well. It had been wrong since it was written and
   * nothing noticed: `audit-dataset` asked the same question in a counter of its
   * own — correctly — and nothing called this. The old assertion here passed
   * either way, because it looked for `tr` in the answer rather than asking what
   * the answer is.
   *
   * Both halves, over every declared language: unseeable exactly when the script
   * test cannot read it and no word list covers it.
   */
  it('is Latin script and no word list, and neither half alone', () => {
    const unseeable = new Set(unseeableIn([...LANGUAGES], scriptOf));

    for (const language of LANGUAGES) {
      const latin = scriptOf(language) === 'latin';
      const listed = Boolean(words[language]);

      expect(unseeable.has(language)).toBe(latin && !listed);
    }

    // A language the script test reads is never unseeable, however few words are
    // listed for it — which is the half the body was missing.
    const nonLatin = LANGUAGES.filter((language) => scriptOf(language) !== 'latin');
    expect(nonLatin.length).toBeGreaterThan(0);
    for (const language of nonLatin) expect(unseeable.has(language)).toBe(false);
  });

  it('covers every Latin-script language it can, so the hole is named and small', () => {
    // If a language is added with a list, this number moves and somebody reads
    // why. If one is added without, it lands in `unseeableIn` and the audit
    // prints it rather than counting it as read.
    expect(covered.filter((language) => (LANGUAGES as readonly string[]).includes(language)).sort()).toEqual([
      'de',
      'en',
      'es',
      'fr',
      'jv',
      'ms',
      'pt',
      'vi',
    ]);
  });
});

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

