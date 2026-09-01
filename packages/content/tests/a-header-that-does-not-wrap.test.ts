import { describe, expect, it } from 'vitest';

import { messageFor, translatedLanguages } from '../src/messages';

/**
 * Sentences that live in a place with a width.
 *
 * The board's header is one line and does not wrap: it truncates. The Russian
 * `app.waiting` was fifty-two characters against English's twenty-nine, so a
 * Russian player read «Бросайте кубик: войти в игру можн…» — and the App Store
 * screenshots taken for the Russian storefront carried that ellipsis into the
 * shopfront, which is where it was finally noticed.
 *
 * A width cannot be measured from a string alone — a rendered character is not
 * a code point, and Devanagari and Arabic set differently again. So this holds
 * the translations to the length of the English they stand beside, with room:
 * not a promise that a sentence fits, but a refusal to be three times longer
 * than the sentence the layout was built around.
 */
describe('a header that does not wrap', () => {
  /**
   * Keys rendered into a single fixed line.
   *
   * One, and that is a measurement rather than a shortcut: the stylesheet
   * declares exactly two truncating elements — `.where-title` (the header)
   * and `.visiting > span` — and of the catalogue's words only `app.waiting`
   * reaches either. Everything else in the visiting bar and the header is a
   * plan title, which is data, not a message. Those were measured too on
   * 2026-08-23: the longest Russian title is 43 characters against English's
   * 40, so the header cuts long titles equally in both languages and no
   * translation is the reason. Add a key here when a new `messageFor` lands
   * in an element with `text-overflow: ellipsis`.
   */
  const NARROW = ['app.waiting'] as const;

  /**
   * How much longer than English a translation may be.
   *
   * Russian and German run longer than English by nature; a flat cap would
   * fail honest translations. Fifty per cent is wide enough for those and
   * narrow enough that a fifty-two-character line against twenty-nine — the
   * one that shipped — is caught.
   */
  const ROOM = 1.5;

  for (const key of NARROW) {
    it(`keeps every translation of ${key} within half again of the English`, () => {
      const english = messageFor('en', key);
      const bound = Math.ceil(english.length * ROOM);

      const overrun = translatedLanguages()
        .map((language) => ({ language, said: messageFor(language, key) }))
        .filter(({ said }) => said.length > bound)
        .map(({ language, said }) => `${language}: ${said.length} chars — ${said}`);

      expect(
        overrun,
        `the header truncates; English is ${english.length} chars, the bound is ${bound}`,
      ).toEqual([]);
    });
  }
});
