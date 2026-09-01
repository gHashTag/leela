/**
 * The die a variant says it has.
 *
 * `rollerFor(rules, base)` is the engine's answer to *which die does this
 * variant turn*: under `rerollOnRepeat` it wraps the roller so a repeated value
 * is thrown again once, and otherwise it hands the same die straight back. The
 * bot goes through it — `rollerFor(room.session.rules, seededRoller(room.seed))`
 * — and so does the mini app.
 *
 * This app did not. `newGame` took a `RuleSet` and used it for everything else,
 * and built its die as `seededRoller(seed)`. So a game under `legacy-mobile` or
 * `online` — both of which re-roll a repeat — turned a plain die while calling
 * itself that variant.
 *
 * **And it is reachable here of all places.** `game-store.ts` calls
 * `newGame(parsed.seed, rules)` with a ruleset read out of the store, which is
 * how a player brought across from the published app arrives: holding
 * `legacy-mobile`, the variant this repository keeps *only* so that app can be
 * reproduced exactly.
 *
 * `rerollOnRepeat` is the field this repository once found declared, set
 * correctly everywhere and consulted by nothing — the finding that made
 * `audit-unread` exist. This is the same field, half-consulted.
 *
 * These assert the shape rather than one variant: **whatever a ruleset says
 * about the die, the game turns that die** — and, in the other direction, a
 * variant that asks for nothing gets the die it was given, so a player under
 * `CLASSIC` sees no change at all.
 */

import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  NEUROLEELA,
  ONLINE,
  RULESETS,
  rollMany,
  rollerFor,
  seededRoller,
} from '@leela/engine';
import { newGame } from '../src/game';

/** Every value the game's die gives, in order, for one seed. */
const thrown = (rules: Parameters<typeof newGame>[1], count = 400): number[] =>
  rollMany(newGame(7, rules).die, count);

/** How often a value repeats the one before it. */
const repeats = (values: number[]): number =>
  values.filter((value, at) => at > 0 && value === values[at - 1]).length;

describe('the die a game turns', () => {
  it('re-rolls a repeat wherever the ruleset asks for it', () => {
    // Not "is the roller wrapped" — what the die does. A plain die repeats
    // about one throw in six; one that throws again on a repeat does it far
    // less, and that is the whole of what the flag buys.
    for (const rules of [LEGACY_MOBILE, ONLINE]) {
      const seen = repeats(thrown(rules));

      expect({ rules: rules.id, repeats: seen < 400 / 12 }).toEqual({
        rules: rules.id,
        repeats: true,
      });
    }
  });

  it('leaves the die alone wherever it does not', () => {
    // The other half. A game that re-rolled under `CLASSIC` would be a
    // different game from the one people are playing, and this repair must not
    // become that.
    for (const rules of [CLASSIC, NEUROLEELA]) {
      const seen = repeats(thrown(rules));

      expect({ rules: rules.id, repeats: seen > 400 / 12 }).toEqual({
        rules: rules.id,
        repeats: true,
      });
    }
  });

  it('turns the same die the engine would build for that ruleset', () => {
    // The claim in its strongest form: for every variant, the game's die and
    // the engine's own answer for that variant agree throw for throw from the
    // same seed.
    for (const rules of Object.values(RULESETS)) {
      // Built the way the bot builds it.
      const asTheBotWould = rollMany(rollerFor(rules, seededRoller(7)), 60);

      expect({ rules: rules.id, same: thrown(rules, 60) }).toEqual({
        rules: rules.id,
        same: asTheBotWould,
      });
    }
  });

  it('is still the same game from the same seed', () => {
    // A seeded die is what makes a game replayable, and wrapping it must not
    // cost that: two games from one seed under one ruleset throw alike.
    expect(thrown(LEGACY_MOBILE, 50)).toEqual(thrown(LEGACY_MOBILE, 50));
    expect(thrown(CLASSIC, 50)).toEqual(thrown(CLASSIC, 50));
  });
});
