/**
 * The rules of Leela as pure functions.
 *
 * Nothing here reads a database, calls a network or logs. Every function is
 * total: same input, same output. That is what lets the mobile app, the bot,
 * the web build and the contract agree on what a roll means.
 */

import {
  ARROWS,
  MAX_ROLL,
  SIXES_TO_RESET,
  SNAKES,
  START_LOKA,
  TOTAL_PLANS,
  WIN_LOKA,
} from './board';
import type { Direction } from './types';

export interface SixesOutcome {
  /** Sixes rolled back to back after this roll. */
  newConsecutive: number;
  /** Position implied by the roll, before snakes and arrows apply. */
  newPosition: number;
  /** Position to fall back to if a third six lands. */
  newBeforeThreeSixes: number;
  /** Set only when a third six forced a reset. */
  direction?: Direction;
}

/**
 * Track the run of sixes and, on the third one, send the player back to where
 * the run began.
 *
 * The first six remembers the position the player left; the second keeps that
 * memory; the third returns them to it and clears the counter.
 */
export function handleConsecutiveSixes(
  roll: number,
  currentLoka: number,
  consecutive: number,
  positionBeforeThreeSixes: number,
  threeSixesReset = true,
): SixesOutcome {
  if (roll !== MAX_ROLL) {
    return {
      newConsecutive: 0,
      newPosition: currentLoka + roll,
      newBeforeThreeSixes: positionBeforeThreeSixes,
    };
  }

  const newConsecutive = consecutive + 1;

  if (threeSixesReset && newConsecutive === SIXES_TO_RESET) {
    return {
      newConsecutive: 0,
      newPosition: positionBeforeThreeSixes,
      newBeforeThreeSixes: positionBeforeThreeSixes,
      direction: 'snake 🐍',
    };
  }

  return {
    newConsecutive,
    newPosition: currentLoka + roll,
    // Only the first six of a run records where the run started.
    newBeforeThreeSixes: consecutive === 0 ? currentLoka : positionBeforeThreeSixes,
  };
}

export interface PositionOutcome {
  finalLoka: number;
  direction: Direction;
  isGameFinished: boolean;
}

/**
 * Resolve a tentative position into a final one by applying, in order:
 * the pre-game gate on WIN_LOKA, the win condition, the board limit, snakes
 * and finally arrows.
 *
 * @param newLoka  Position implied by the roll, before snakes and arrows.
 * @param isFinished  Whether the player currently sits out on WIN_LOKA.
 * @param roll  The die value, needed for the pre-game gate.
 * @param currentLoka  Where the player stood before the roll.
 */
export function getDirectionAndPosition(
  newLoka: number,
  isFinished: boolean,
  roll: number,
  currentLoka: number,
): PositionOutcome {
  // Before the game starts (and after it is won) the player waits on WIN_LOKA
  // until a six lets them in.
  if (currentLoka === WIN_LOKA && isFinished) {
    if (roll === MAX_ROLL) {
      return { finalLoka: START_LOKA, direction: 'step 🚶🏼', isGameFinished: false };
    }
    return { finalLoka: WIN_LOKA, direction: 'stop 🛑', isGameFinished: true };
  }

  // Landing exactly on Cosmic Consciousness wins.
  if (newLoka === WIN_LOKA) {
    return { finalLoka: newLoka, direction: 'win 🕉', isGameFinished: true };
  }

  // A roll that would overshoot the board is refused; the player stays put.
  if (newLoka > TOTAL_PLANS) {
    return { finalLoka: currentLoka, direction: 'stop 🛑', isGameFinished: false };
  }

  const snake = SNAKES[newLoka];
  if (snake !== undefined) {
    return { finalLoka: snake, direction: 'snake 🐍', isGameFinished: false };
  }

  const arrow = ARROWS[newLoka];
  if (arrow !== undefined) {
    // Arrow 54 -> 68 is a legal way to win.
    return {
      finalLoka: arrow,
      direction: 'arrow 🏹',
      isGameFinished: arrow === WIN_LOKA,
    };
  }

  return { finalLoka: newLoka, direction: 'step 🚶🏼', isGameFinished: false };
}

/** True when `position` is a legal square. Kept for callers migrating off GameService. */
export function validatePosition(position: number): boolean {
  return position >= 1 && position <= TOTAL_PLANS;
}
