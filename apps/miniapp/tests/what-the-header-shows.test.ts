import { describe as group, expect, it } from 'vitest';
import { LANGUAGES, messageFor, translatedLanguages, type Language } from '@leela/content';

/**
 * How much of the header a player actually reads.
 *
 * `#plan-title` is `white-space: nowrap; overflow: hidden; text-overflow:
 * ellipsis`, and MEASURED on the live classic board at 375 CSS pixels on
 * 2026-08-29 it is **158px wide, 146 once the ellipsis has taken its room**.
 * Nothing it is ever given fits:
 *
 *     app.waiting, English    203px   "Throw a six to enter t…"
 *     app.waiting, Russian    227px   «Бросьте шестёрку, …»
 *     the longest plan title, in ALL TWENTY-TWO languages, 172–372px
 *
 * There is no room to be found either — the header is a grid of three 44px
 * touch targets, this block and three 10px gaps, which is 351 exactly.
 *
 * **THAT IS TOLERABLE ONLY BECAUSE THE INFORMATIVE WORDS COME FIRST**, and
 * that is what this file holds. The truncation costs a parenthetical Sanskrit
 * name; it must never cost the word that tells a waiting player what enters.
 *
 * The defect is not hypothetical. `view.test.ts` asserts the Russian sentence
 * contains the stem «шестёрк», and its own comment records a rewrite that said
 * the same thing another way — *«войти в игру можно только с шестёрки»*. That
 * wording puts the stem at character 27 of a string of which **eighteen are
 * visible**, so it would satisfy that test while showing a Russian player
 * «войти в игру можно…» and never the six. Containing a word and showing it
 * are different claims, and only one of them had a guard.
 *
 * An attempt to remove the truncation instead — leaving the header blank until
 * there is a plan — was made and REVERTED: `view.test.ts` refused it, rightly.
 * The sentence is legible where it counts, and blanking it would have taken
 * information away to buy tidiness.
 */

/**
 * Characters that survive the ellipsis, per script, measured with the header's
 * own font (`normal 400 15px -apple-system…`) against its own 146px.
 *
 * Two numbers because a Cyrillic character is wider: 22 Latin, 18 Cyrillic.
 * The tighter one is used for everything — a budget that is right for the
 * widest script is right for the others, and one number cannot drift from the
 * other.
 */
const VISIBLE = 18;

/**
 * The word each catalogue must SHOW, not merely contain.
 *
 * A list somebody has to add to, which is the point: `app.waiting` exists in
 * two catalogues today and the check below fails if a third appears without an
 * entry here. Choosing the token is a judgement about a language, and it
 * should be made by somebody who reads it rather than by a pattern.
 */
const NAMES_THE_SIX: Partial<Record<Language, RegExp>> = {
  en: /six/i,
  ru: /шестёрк|шестерк/i,
};

group('the sentence a waiting player can actually read', () => {
  it('shows the word that names what enters, inside the room there is', () => {
    for (const [language, token] of Object.entries(NAMES_THE_SIX) as [Language, RegExp][]) {
      const whole = messageFor(language, 'app.waiting');
      const seen = whole.slice(0, VISIBLE);

      /*
       * THE BUDGET MUST ACTUALLY CUT SOMETHING. Widening `VISIBLE` past the
       * length of the sentence turns every assertion below into a claim about
       * the whole string — green, and about nothing. Measured: 18 against 29
       * characters of English and 29 of Russian, so it bites in both.
       *
       * Found by falsification: raising the budget from 18 to 60 left this
       * file passing, which is the one edit that should never be silent.
       */
      expect(VISIBLE, `${language}: the budget still truncates «${whole}»`).toBeLessThan(whole.length);
      expect(whole, `${language}: the catalogue still says it`).toMatch(token);
      expect(seen, `${language}: and says it in the first ${VISIBLE} characters, which is all a player sees of «${whole}»`).toMatch(
        token,
      );
    }
  });

  it('checks every catalogue that has an opinion about it', () => {
    /*
     * The guard on the guard. `NAMES_THE_SIX` is a hand-kept list, and a hand-
     * kept list of languages goes stale the moment somebody translates one
     * more — silently, because a missing entry is simply not looped over.
     */
    const opinionated = translatedLanguages().filter(
      (language) => messageFor(language, 'app.waiting') !== messageFor('en', 'app.waiting'),
    );

    for (const language of opinionated) {
      expect(
        NAMES_THE_SIX[language],
        `${language} translates app.waiting and nothing says which word must survive the ellipsis`,
      ).toBeDefined();
    }

    // Non-vacuous: there IS at least one translation to check.
    expect(opinionated.length).toBeGreaterThan(0);
  });

  it('is a rule about a sentence somebody is really shown', () => {
    /*
     * Every language that does not translate it falls back to English, so the
     * English budget is the one twenty of the twenty-two live under. If that
     * ever stops being true this says so rather than quietly checking two
     * languages out of twenty-two.
     */
    const fallingBack = LANGUAGES.filter(
      (language) => messageFor(language, 'app.waiting') === messageFor('en', 'app.waiting'),
    );

    expect(fallingBack.length, 'most languages read the English sentence').toBeGreaterThan(10);
    expect(messageFor('en', 'app.waiting').slice(0, VISIBLE)).toMatch(/six/i);
  });
});
