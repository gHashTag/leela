/**
 * Where the player has been, stored as the **rolls** rather than the squares.
 *
 * The engine's `replay` turns a list of throws back into every move it
 * produced, so a path is derived and cannot disagree with the rules: a stored
 * list of squares is a second account of the game, and a second account is one
 * that goes wrong the first time a `RuleSet` changes. Six values a throw, and
 * the whole history of a game is shorter than one of its plan titles.
 *
 * Only what the storage needs is here. `pathOf` and `squaresOf` — turning the
 * throws into a readable history — were written in the same pass and deleted
 * unread, because `audit-unread` named them and an export with no caller is a
 * guess about what a screen will want. They come back with the screen.
 */

import {
  DEFAULT_RULESET,
  type GameState,
  type RuleSet,
  initialState,
  replay,
} from '@leela/engine';

export const MIN_ROLL = 1;
export const MAX_ROLL = 6;

/** Whether a stored list is one this game could have thrown. */
export const areRolls = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.every(
    (roll) => Number.isInteger(roll) && (roll as number) >= MIN_ROLL && (roll as number) <= MAX_ROLL,
  );

/** Where the throws leave the player. The engine's answer, not a stored one. */
export const stateAfter = (
  rolls: readonly number[],
  rules: RuleSet = DEFAULT_RULESET,
  from: GameState = initialState(),
): GameState => replay(rolls, from, rules).at(-1)?.state ?? from;
