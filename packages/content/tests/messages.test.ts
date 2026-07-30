import { describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  englishCatalogue,
  messageCoverage,
  messageFor,
  messageIssues,
  placeholdersIn,
  translatedLanguages,
  type Message,
  type MessageKey,
} from '../src';

const KEYS = Object.keys(englishCatalogue()) as MessageKey[];

/** Every text a message can produce, plural forms included. */
function textsOf(message: Message): string[] {
  return typeof message === 'string' ? [message] : Object.values(message);
}

describe('the catalogue', () => {
  it('has an English text for every key, because the keys are the English ones', () => {
    for (const key of KEYS) {
      for (const text of textsOf(englishCatalogue()[key])) {
        expect(text.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('covers every sentence the bot says', () => {
    // Not an exhaustive list — a spot check that the catalogue is the whole
    // surface and not a sample of it. The pseudo-language test in apps/bot is
    // the exhaustive one.
    for (const key of ['help', 'roll.notYourTurn', 'move.snake', 'chat.unknown', 'button.roll']) {
      expect(KEYS).toContain(key);
    }
  });

  it('reports what each language covers rather than implying it is complete', () => {
    const coverage = messageCoverage();
    const english = coverage.find((c) => c.language === 'en');
    const russian = coverage.find((c) => c.language === 'ru');

    expect(english?.missing).toEqual([]);
    expect(russian?.missing).toEqual([]);
    expect(russian?.total).toBe(KEYS.length);
  });

  it('names the languages that have a catalogue, English first', () => {
    expect(translatedLanguages()[0]).toBe('en');
    for (const language of translatedLanguages()) {
      expect(LANGUAGES).toContain(language);
    }
  });
});

describe('placeholders', () => {
  it('finds the names a message expects', () => {
    expect(placeholdersIn('{name} throws {value}.')).toEqual(['name', 'value']);
  });

  it('looks in every plural form, not only the first', () => {
    expect(placeholdersIn({ one: '{count} plan', other: '{count} plans, {name}' })).toEqual([
      'count',
      'name',
    ]);
  });

  it('leaves alone a brace that is not a placeholder', () => {
    // Plan bodies contain braces; a greedy pattern would eat them.
    expect(placeholdersIn('a { b } c {}')).toEqual([]);
  });

  it('fills the ones it is given', () => {
    expect(messageFor('en', 'roll.next', { name: 'Anna' })).toBe('Anna is next.');
  });

  it('leaves a placeholder visible rather than throwing mid-game', () => {
    // A message that crashes is worse than one that reads oddly: the player
    // would get nothing at all, and the turn would look lost.
    expect(messageFor('en', 'roll.next', {})).toBe('{name} is next.');
  });
});

describe('choosing a language', () => {
  it('answers in the language asked for', () => {
    expect(messageFor('ru', 'start.already')).toBe('Игра уже идёт.');
  });

  it('resolves a locale onto its language', () => {
    expect(messageFor('ru-RU', 'start.already')).toBe(messageFor('ru', 'start.already'));
  });

  it('falls back to English per key, so a half-translated language still works', () => {
    // Serving nothing, or serving the key, are the two failure modes this
    // avoids; a player reading an English sentence can still play.
    for (const language of LANGUAGES) {
      for (const key of KEYS) {
        const text = messageFor(language, key, { count: 1 });
        expect(text.length, `${language} ${key}`).toBeGreaterThan(0);
        expect(text, `${language} ${key}`).not.toBe(key);
      }
    }
  });

  it('falls back to English for a language nobody wrote a catalogue for', () => {
    expect(messageFor('ja', 'start.already')).toBe(messageFor('en', 'start.already'));
  });
});

describe('plurals belong to the language, not to English', () => {
  it('uses the English pair', () => {
    expect(messageFor('en', 'path.heading', { count: 1 })).toBe('Your path — 1 plan.');
    expect(messageFor('en', 'path.heading', { count: 2 })).toBe('Your path — 2 plans.');
  });

  it('uses all three Russian forms, which a one/other catalogue cannot', () => {
    // 1 план, 2 плана, 5 планов. A catalogue with only `one` and `other`
    // prints "5 плана", which is the defect this shape exists to prevent.
    expect(messageFor('ru', 'path.heading', { count: 1 })).toContain('1 план.');
    expect(messageFor('ru', 'path.heading', { count: 2 })).toContain('2 плана.');
    expect(messageFor('ru', 'path.heading', { count: 5 })).toContain('5 планов.');
    expect(messageFor('ru', 'path.heading', { count: 21 })).toContain('21 план.');
  });

  it('gives every language every form it declares it needs', () => {
    // The assertion is about the shape: whatever Intl says this language
    // distinguishes, the catalogue must distinguish too. It is not a list of
    // the languages that happen to be translated today.
    for (const { language } of messageCoverage()) {
      const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
      for (const key of KEYS) {
        if (typeof englishCatalogue()[key] === 'string') continue;
        for (const category of categories) {
          const count = { zero: 0, one: 1, two: 2, few: 3, many: 5, other: 11 }[category] ?? 11;
          expect(messageFor(language, key, { count }), `${language} ${key} ${category}`).toContain(
            String(count),
          );
        }
      }
    }
  });
});

describe('what is wrong with a catalogue', () => {
  it('finds nothing wrong with the ones shipped', () => {
    expect(messageIssues()).toEqual([]);
  });

  it('would notice a dropped placeholder, a foreign one, or a missing form', () => {
    // `messageIssues` reads the shipped catalogues and they are correct, so it
    // has never returned anything. A check that has never fired has not been
    // shown to fire; the same reasoning is applied here to its three rules.
    const english = { greet: '{name} rolls {value}', count: { one: '{count}', other: '{count}' } };
    const suspect = {
      dropped: { greet: '{name} rolls' },
      foreign: { greet: '{name} rolls {value} on {plan}' },
      flattened: { count: '{count} planov' },
    };

    const problems = (translation: Record<string, Message>) => {
      const found: string[] = [];
      for (const [key, value] of Object.entries(translation)) {
        const expected = placeholdersIn(english[key as keyof typeof english]);
        const actual = placeholdersIn(value);
        for (const name of actual) if (!expected.includes(name)) found.push(`foreign:${name}`);
        for (const name of expected) if (!actual.includes(name)) found.push(`dropped:${name}`);
        if (typeof english[key as keyof typeof english] !== 'string' && typeof value === 'string') {
          found.push('flattened');
        }
      }
      return found;
    };

    expect(problems(suspect.dropped)).toEqual(['dropped:value']);
    expect(problems(suspect.foreign)).toEqual(['foreign:plan']);
    expect(problems(suspect.flattened)).toEqual(['flattened']);
  });
});
