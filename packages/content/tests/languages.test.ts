import { beforeAll, describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  asLeftToRight,
  directionOf,
  plansFor,
} from '../src';

/**
 * A language is more than its texts.
 *
 * `directionOf` and the endonyms lived in `apps/docs`, the first surface that
 * happened to need them. The mini app needed them too and had none: it set
 * `lang` and not `dir`, so Arabic and Urdu were drawn left to right. That is
 * the recurring shape in this repository — knowledge kept next to its first
 * caller instead of next to its subject — and it is why these are here.
 */

describe('which way a language reads', () => {
  it('knows the two scripts here that read right to left', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('ur')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });

  it('answers for every language, not only the ones asked about so far', () => {
    for (const language of LANGUAGES) {
      expect(['ltr', 'rtl'], language).toContain(directionOf(language));
    }
  });

  it('agrees with the script the plans are actually written in', () => {
    // The direction table is a claim about the content. If a language's plans
    // are in Arabic script it reads right to left, whoever wrote the table —
    // so the content is what the table is checked against.
    const arabicScript = /[؀-ۿ]/;
    for (const language of LANGUAGES) {
      const sample = plansFor(language)
        .slice(0, 12)
        .map((plan) => plan.title)
        .join(' ');
      expect(directionOf(language) === 'rtl', `${language}: ${sample.slice(0, 40)}`).toBe(
        arabicScript.test(sample),
      );
    }
  });
});

describe('what a language calls itself', () => {
  it('has an endonym for every language', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language], language).toBeTruthy();
    }
  });

  it('names each language in its own script, not in English', () => {
    // A picker labelled "Arabic, Bengali, Hindi" is a picker for people who
    // already read English. Every non-Latin language must be non-Latin here.
    const latinOnly = /^[\p{Script=Latin}\p{P}\s]+$/u;
    const writtenInLatin = ['de', 'en', 'es', 'fr', 'jv', 'ms', 'pt', 'tr', 'vi'];
    for (const language of LANGUAGES) {
      const name = LANGUAGE_NAMES[language];
      expect(latinOnly.test(name), `${language} is "${name}"`).toBe(
        writtenInLatin.includes(language),
      );
    }
  });

  it('lists exactly the languages the content covers', () => {
    // Not "has 22 entries": a language added to the content with no endonym
    // would show up in a picker as a blank link.
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual([...LANGUAGES].sort());
  });
});

describe('a diagram is not a sentence', () => {
  // The board's squares are digits, and digits are weak in the bidirectional
  // algorithm: inside a right-to-left paragraph a row reading `01 02 03` is
  // displayed as `03 02 01`. Nothing in the string is wrong and the board is
  // mirrored anyway. These assert the isolate is there, not what it looks like.
  it('wraps a run so the reader cannot reorder it', () => {
    const isolated = asLeftToRight('01 02 03');
    expect(isolated.codePointAt(0)).toBe(0x2066);
    expect(isolated.codePointAt(isolated.length - 1)).toBe(0x2069);
    expect(isolated).toContain('01 02 03');
  });

  it('changes nothing a reader sees, only how it is ordered', () => {
    const board = '01 02 03\n04 05 06';
    expect(asLeftToRight(board).replace(/[⁦⁩]/g, '')).toBe(board);
  });

  it('is balanced, so it cannot leak into the text after it', () => {
    // An unclosed isolate takes the rest of the message with it. One open and
    // one close, in that order.
    const isolated = asLeftToRight('board');
    expect([...isolated].filter((c) => c === '⁦')).toHaveLength(1);
    expect([...isolated].filter((c) => c === '⁩')).toHaveLength(1);
    expect(isolated.indexOf('⁦')).toBeLessThan(isolated.indexOf('⁩'));
  });
});
import { EVERY_LANGUAGE_MS,
  loadEveryLanguage } from '../src/index';

/**
 * Every language's text, in memory, before anything asks for it.
 *
 * Twenty-one of the twenty-two are loaded on demand now — the board's entry
 * carried 6.6 MB of plan text to a reader of one language, and only English is
 * static because it is the fallback. A suite that reads other languages has to
 * say so, and this is that saying: without it these tests would quietly
 * measure English twenty-two times and pass.
 */
beforeAll(loadEveryLanguage, EVERY_LANGUAGE_MS);

