/**
 * Board topology for Leela (Leela Chakra / НейроЛила).
 *
 * These values are the single source of truth for every client: mobile app,
 * Telegram bot, web site and the on-chain contract. They were extracted
 * verbatim from NeuroLeelaAgent/services/GameService.ts so that behaviour of
 * the unified engine is byte-identical to the last shipped implementation.
 */

/** Total number of plans (lokas) on the board. */
export const TOTAL_PLANS = 72;

/** Cosmic Consciousness. Reaching it exactly wins the game. */
export const WIN_LOKA = 68;

/** A die has six faces; six is also the value that starts a new game. */
export const MAX_ROLL = 6;

/** Where a player lands on the first six that starts the game. */
export const START_LOKA = 6;

/** Three sixes in a row send the player back to where the run began. */
export const SIXES_TO_RESET = 3;

/**
 * Snakes: landing on the key sends the player down to the value.
 */
export const SNAKES: Readonly<Record<number, number>> = Object.freeze({
  12: 8,
  16: 4,
  24: 7,
  29: 6,
  44: 9,
  52: 35,
  55: 3,
  61: 13,
  63: 2,
  72: 51,
});

/**
 * Arrows: landing on the key lifts the player up to the value.
 */
export const ARROWS: Readonly<Record<number, number>> = Object.freeze({
  10: 23,
  17: 69,
  20: 32,
  22: 60,
  27: 41,
  28: 50,
  37: 66,
  45: 67,
  46: 62,
  54: 68,
});

/** True when `position` is a legal square on the board. */
export function isOnBoard(position: number): boolean {
  return Number.isInteger(position) && position >= 1 && position <= TOTAL_PLANS;
}

/** The snake that starts at `position`, or null when there is none. */
export function snakeAt(position: number): number | null {
  return SNAKES[position] ?? null;
}

/** The arrow that starts at `position`, or null when there is none. */
export function arrowAt(position: number): number | null {
  return ARROWS[position] ?? null;
}
