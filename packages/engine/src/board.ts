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

/**
 * The face a die shows before anyone throws it.
 *
 * Presentation rather than a rule — but presentation two surfaces must agree
 * on, and each had written its own six. The entry throw is the face worth
 * resting on: the die waits showing the throw the game is waiting for.
 */
export const RESTING_FACE = MAX_ROLL;

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

/**
 * How the 72 plans are laid out on a physical board: eight rows of nine,
 * counted from the bottom, alternating direction — 1..9 left to right, then
 * 10..18 right to left, and so on, with 72 in the top-left corner.
 *
 * Taken from the published app's `GameBoard`, which draws over a photograph of
 * the board, so this is the arrangement players already know. Rows are listed
 * top first, the way they are rendered.
 */
export const BOARD_ROWS: ReadonlyArray<ReadonlyArray<number>> = Object.freeze([
  [72, 71, 70, 69, 68, 67, 66, 65, 64],
  [55, 56, 57, 58, 59, 60, 61, 62, 63],
  [54, 53, 52, 51, 50, 49, 48, 47, 46],
  [37, 38, 39, 40, 41, 42, 43, 44, 45],
  [36, 35, 34, 33, 32, 31, 30, 29, 28],
  [19, 20, 21, 22, 23, 24, 25, 26, 27],
  [18, 17, 16, 15, 14, 13, 12, 11, 10],
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
].map((row) => Object.freeze(row)));

export const BOARD_ROWS_COUNT = 8;
export const BOARD_COLUMNS = 9;

/** Where a plan sits on the board: row 0 is the top row, column 0 the left. */
export function boardPosition(plan: number): { row: number; column: number } {
  for (const [row, squares] of BOARD_ROWS.entries()) {
    const column = squares.indexOf(plan);
    if (column !== -1) return { row, column };
  }
  throw new RangeError(`plan ${plan} is not on the board`);
}

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
