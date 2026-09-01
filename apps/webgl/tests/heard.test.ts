import { describe, expect, it } from 'vitest';
import { LANGUAGES, scriptOf } from '@leela/content';

import { answerIn, heardIn } from '../src/heard';

/**
 * Answering somebody in the language they wrote in.
 *
 * Found on a phone: the board was in English because the phone was, the player
 * typed «Как играть?», and the companion answered in English — because it had
 * been told to reply in the *interface's* language, which nobody had told it
 * was a different question.
 */

describe('the language a message is written in', () => {
  it('hears Russian in Cyrillic on an English board', () => {
    expect(heardIn('Как играть?', 'en')).toBe('ru');
    expect(answerIn('Как играть?', 'en')).toBe('ru');
  });

  it('leaves an English message on an English board alone', () => {
    expect(answerIn('what does this plan ask of me', 'en')).toBe('en');
  });

  it('answers a Ukrainian reader in Ukrainian, not in Russian', () => {
    // The case a script alone cannot decide: Cyrillic is both. The board's own
    // language wins whenever it is written in the script that was heard, which
    // is the whole reason this is not `dominantScript` called directly.
    expect(heardIn('Як грати?', 'uk')).toBe('uk');
    expect(heardIn('Как играть?', 'uk')).toBe('uk');
  });

  it('hears the board out when the reader writes in its script', () => {
    // Every language, asked about its own words: none of them may be answered
    // in somebody else's.
    for (const language of LANGUAGES) {
      const sample = { ru: 'привет', uk: 'привіт', en: 'hello' }[language as string];
      if (!sample) continue;
      expect(heardIn(sample, language), language).toBe(language);
    }
  });

  it('says nothing about a message with no letters in it', () => {
    // «?», an emoji, a number. Not a language, and a guess would be worse than
    // the board's own.
    for (const empty of ['', '?', '!!!', '42', '🙂', '   ']) {
      expect(heardIn(empty, 'en'), empty).toBeNull();
      expect(answerIn(empty, 'en'), empty).toBe('en');
    }
  });

  it('falls back to the board rather than to a language nobody reads', () => {
    // A script the catalogue has no language for resolves to the board's, not
    // to null reaching the model as an instruction to reply in nothing.
    expect(answerIn('ᚠᚢᚦᚨᚱᚲ', 'en')).toBe('en');
  });

  it('only ever answers in a language the catalogue has', () => {
    for (const text of ['Как играть?', 'hello', '你好', 'مرحبا', 'こんにちは']) {
      const answer = answerIn(text, 'en');
      expect(LANGUAGES, text).toContain(answer);
      // And in a language whose script this repository has declared, or
      // `scriptOf` throws and the companion dies mid-question.
      expect(() => scriptOf(answer)).not.toThrow();
    }
  });
});
