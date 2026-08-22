import { describe, expect, it } from 'vitest';

import {
  SPEAKS,
  isSpoken,
  nextLanguage,
  openingLanguage,
  readLanguage,
  writeLanguage,
} from '../src/tongue';

/** A storage that behaves, and one that refuses the way private mode does. */
const kept = (start: Record<string, string> = {}) => {
  const held = { ...start };
  return {
    getItem: (key: string) => held[key] ?? null,
    setItem: (key: string, value: string) => {
      held[key] = value;
    },
    read: () => held,
  };
};

const refuses = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('which languages are offered', () => {
  /**
   * The board's text exists in twenty-two languages and the interface in two.
   * Offering the other twenty gives a player readable squares and unreadable
   * buttons, which looks like a defect rather than a gap.
   */
  it('offers only the ones the interface actually speaks', () => {
    expect(SPEAKS).toEqual(['en', 'ru']);
  });

  it.each(['en', 'ru'])('%s is spoken', (language) => {
    expect(isSpoken(language)).toBe(true);
  });

  it.each(['de', 'zh', 'hi', 'xx', ''])('%s is not', (language) => {
    expect(isSpoken(language)).toBe(false);
  });
});

describe('the language to open in', () => {
  it('honours a stored choice over the browser', () => {
    expect(openingLanguage('ru', 'en-US')).toBe('ru');
    expect(openingLanguage('en', 'ru-RU')).toBe('en');
  });

  it('falls to the browser when nothing was chosen', () => {
    expect(openingLanguage(null, 'ru-RU')).toBe('ru');
    expect(openingLanguage(null, 'en-GB')).toBe('en');
  });

  it.each(['ru', 'ru-RU', 'ru_RU', 'RU'])('reads %s as Russian', (locale) => {
    expect(openingLanguage(null, locale)).toBe('ru');
  });

  it('falls to English for a language the interface does not speak', () => {
    // The board would render in German; the buttons would not.
    expect(openingLanguage(null, 'de-DE')).toBe('en');
    expect(openingLanguage(null, 'zh-Hans')).toBe('en');
  });

  it('ignores a stored value that is not a language', () => {
    expect(openingLanguage('xx', 'ru-RU')).toBe('ru');
    expect(openingLanguage('', 'ru-RU')).toBe('ru');
  });

  it('answers something usable for nonsense from the browser', () => {
    expect(SPEAKS).toContain(openingLanguage(null, ''));
    expect(SPEAKS).toContain(openingLanguage(null, 'not-a-locale'));
  });
});

describe('cycling', () => {
  it('swaps between the two', () => {
    expect(nextLanguage('en')).toBe('ru');
    expect(nextLanguage('ru')).toBe('en');
  });

  it('comes back where it started', () => {
    for (const language of SPEAKS) {
      expect(nextLanguage(nextLanguage(language))).toBe(language);
    }
  });
});

describe('remembering', () => {
  it('keeps the choice for the next visit', () => {
    const store = kept();
    expect(writeLanguage(store, 'ru')).toBe(true);
    expect(readLanguage(store)).toBe('ru');
    expect(openingLanguage(readLanguage(store), 'en-US')).toBe('ru');
  });

  it('says so when storage refuses, rather than pretending', () => {
    expect(writeLanguage(refuses, 'ru')).toBe(false);
  });

  it('reads nothing from a storage that refuses, without throwing', () => {
    expect(readLanguage(refuses)).toBeNull();
  });

  it('survives having no storage at all', () => {
    expect(readLanguage(null)).toBeNull();
    expect(writeLanguage(null, 'ru')).toBe(true);
  });
});
