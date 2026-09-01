/**
 * Where the player has been, stored as the **rolls** rather than the squares.
 *
 * The engine's `replay` turns a list of throws back into every move it
 * produced, so a path is derived and cannot disagree with the rules: a stored
 * list of squares is a second account of the game, and a second account is one
 * that goes wrong the first time a `RuleSet` changes. Six values a throw, and
 * the whole history of a game is shorter than one of its plan titles.
 *
 * `pathOf` was written a pass before this and deleted unread, because
 * `audit-unread` named it an export with no caller and that is a guess about
 * what a screen will want. The screen exists now, so it is back — with the
 * shape the screen actually asked for rather than the one guessed at.
 */

import {
  DEFAULT_RULESET,
  MAX_ROLL,
  type GameState,
  type MoveEvent,
  type RuleSet,
  initialState,
  replay,
} from '@leela/engine';

// The engine owns what a throw can be; this surface only asks. `MAX_ROLL` was
// written out here as a second `6` until `audit-doubles` named the copy.
const MIN_ROLL = 1;

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

/** One landing: what was thrown, and where it put you. */
export interface Step {
  /** 1-based, so the first throw of a game is step 1. */
  readonly ordinal: number;
  readonly roll: number;
  readonly from: number;
  readonly to: number;
  /** False when the throw was refused and the player stayed put. */
  readonly moved: boolean;
  readonly event: MoveEvent;
}

/**
 * The path a list of throws produced.
 *
 * Every throw makes a step, including the ones that moved nobody: *you threw 4,
 * it takes a six* is part of the history of a game, and a history that silently
 * drops it tells the player they threw fewer times than they did. Whether it
 * moved them is carried instead, so the screen can decide.
 */
export function pathOf(
  rolls: readonly number[],
  rules: RuleSet = DEFAULT_RULESET,
  from: GameState = initialState(),
): Step[] {
  return replay(rolls, from, rules).map((result, at) => ({
    ordinal: at + 1,
    roll: rolls[at] as number,
    from: result.event.from,
    to: result.event.to,
    moved: result.event.from !== result.event.to,
    event: result.event,
  }));
}
