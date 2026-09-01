import { describe, expect, it } from 'vitest';
import { ONE_DAY_MS } from '@leela/engine';
import { LANGUAGES, formatWait, messageFor } from '../src/index';

/**
 * How long until the next throw, in the player's language.
 *
 * `formatWait` lived in `@leela/engine` and returned `${hours}h ${minutes}m`.
 * The bot dropped that into `roll.cooldown`, which is in the catalogue in
 * Russian, so a player under a variant with a day between throws read *Пока
 * нет. Следующий бросок через 23h 45m.* — two letters of English in the one
 * sentence that tells somebody to come back later.
 *
 * The engine has no catalogue and no language, on purpose, so the words could
 * never have been right there. Same split as `describeMove` and `writerHint`.
 */

describe('a wait is said in the language around it', () => {
  it('carries no Latin letters into a language that has none', () => {
    // The shape of the defect, not the two letters it had: any language whose
    // own script is not Latin must not be handed `h`, `m` or `s`.
    for (const ms of [ONE_DAY_MS, 90_000, 5_000]) {
      const said = formatWait('ru', ms);
      expect(said, `${ms}`).not.toMatch(/[A-Za-z]/);
      expect(said.length, 'and it still says something').toBeGreaterThan(0);
    }
  });

  it('answers for every language the game ships', () => {
    // A language with no catalogue of its own falls back to English, which is
    // the documented gap — what must not happen is an empty sentence or a
    // placeholder left in it.
    for (const language of LANGUAGES) {
      const said = formatWait(language, 3 * 3600_000 + 25 * 60_000);

      expect(said, language).not.toContain('{');
      expect(said.length, language).toBeGreaterThan(0);
    }
  });

  it('says nothing when there is nothing to wait for', () => {
    // Every caller already treats the empty string as "say no sentence about
    // waiting", which is what a wait of zero is.
    expect(formatWait('en', 0)).toBe('');
    expect(formatWait('ru', -1)).toBe('');
  });

  it('reads as hours, minutes or seconds, by size', () => {
    expect(formatWait('en', ONE_DAY_MS)).toBe(messageFor('en', 'wait.hoursMinutes', { hours: 24, minutes: 0 }));
    expect(formatWait('en', 90_000)).toBe(messageFor('en', 'wait.minutesSeconds', { minutes: 1, seconds: 30 }));
    expect(formatWait('en', 5_000)).toBe(messageFor('en', 'wait.seconds', { seconds: 5 }));
  });

  it('is the catalogue’s sentence, not one built here', () => {
    // The point of the move. If this file wrote the words, a second wording
    // would exist the moment another surface needed one.
    expect(formatWait('ru', ONE_DAY_MS)).toBe(
      messageFor('ru', 'wait.hoursMinutes', { hours: 24, minutes: 0 }),
    );
  });
});
