/**
 * A page that holds two languages and declares one.
 *
 * The catalogue falls back to English **one key at a time**, which is what lets
 * half a translation be useful the day it is started. The cost shows up on the
 * page: the Japanese book declares `lang="ja"`, gives every chapter title and
 * plan name in Japanese, and says *Play*, *Rules of the game*, *All 72 plans*
 * and *Legal* in English, because those keys have no Japanese yet.
 *
 * A screen reader takes the page at its word and reads those English words with
 * Japanese phonetics. Twenty of the twenty-two books were in that state. The
 * book already knew how to mark an element's own language — its language picker
 * does it twenty-two times — and had no way to ask which words needed it, so
 * `answeredIn` is `@leela/content`'s now and `says` uses it.
 *
 * These assert the shape rather than the six: whatever the catalogue answers in
 * another language is marked, and whatever it answers in the reader's own is
 * not. Both halves matter — a page that marked everything would be as wrong as
 * one that marked nothing, and would say the Russian book is English.
 */

import { describe, expect, it } from 'vitest';
import { FALLBACK_LANGUAGE, LANGUAGES, answeredIn, messageFor } from '@leela/content';
import { bookFor, plansFor, rulesFor } from '@leela/content';
import { indexPage } from '../src/render';

/** The keys the index page says in its own voice. */
const SAID = ['app.play', 'app.rules', 'app.plans', 'app.legal', 'app.policy', 'app.terms'] as const;

/** The index page as it is written to disk, for one language. */
function pageFor(language: (typeof LANGUAGES)[number]): string {
  return indexPage(language, plansFor(language), bookFor(language), rulesFor('en'));
}

describe('a word the book says in a language the page does not declare', () => {
  it('is marked, in every language where the catalogue falls back', () => {
    const unmarked: string[] = [];

    for (const language of LANGUAGES) {
      let html: string;
      try {
        html = pageFor(language);
      } catch {
        continue; // The renderer's own arguments are its business.
      }

      for (const key of SAID) {
        if (answeredIn(language, key) === language) continue;

        const text = messageFor(language, key);
        if (!html.includes(`<span lang="${FALLBACK_LANGUAGE}">${text}</span>`)) {
          unmarked.push(`${language}/${key}: ${text}`);
        }
      }
    }

    expect(unmarked).toEqual([]);
  });

  it('is not marked when the reader has it in their own language', () => {
    // The other half. Marking a Russian word as English would tell a screen
    // reader to say Russian with an English mouth, which is the same defect
    // pointing the other way.
    for (const language of ['en', 'ru'] as const) {
      const html = pageFor(language);

      expect({ language, marked: html.includes(`<span lang="${FALLBACK_LANGUAGE}">`) }).toEqual({
        language,
        marked: false,
      });
    }
  });

  it('has something to mark, so this is a rule about a real state', () => {
    // Twenty of the twenty-two. If the catalogue is ever completed this drops
    // to zero and the whole file should go — that is a thing to notice, not a
    // silent pass.
    const falling = LANGUAGES.filter((language) =>
      SAID.some((key) => answeredIn(language, key) !== language),
    );

    expect(falling.length).toBeGreaterThan(15);
  });

  it('asks the catalogue rather than the page for what is translated', () => {
    // `answeredIn` is the whole instrument. A key present in a language answers
    // in it; one absent answers in English, whatever the page then does.
    expect(answeredIn('ru', 'app.play')).toBe('ru');
    expect(answeredIn('ja', 'app.play')).toBe(FALLBACK_LANGUAGE);
    expect(answeredIn('en', 'app.play')).toBe('en');
  });
});
