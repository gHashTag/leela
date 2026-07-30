/**
 * The saved game, and what is allowed to come back out of storage.
 *
 * `localStorage` is the only thing this app persists to, and it is writable by
 * anyone with the console open, by an older version of this app, and by a
 * half-finished write. The previous check read one field:
 *
 *     if (!Number.isInteger(parsed.loka) || parsed.loka < 1 || parsed.loka > 72)
 *
 * so a stored value with a plausible square and nonsense everywhere else was
 * handed straight to the engine. `consecutive_sixes: "2"` makes the three-sixes
 * rule silently stop working, because `"2" + 1` is `"21"` and never equals 3.
 *
 * The rule here is not a list of fields to check. It is: **a saved game must be
 * one the engine could have produced.** Anything else is discarded and the
 * player starts over, which is the only honest thing to do with a state whose
 * history cannot be trusted.
 */

import { TOTAL_PLANS, WIN_LOKA, initialState, type Direction, type GameState } from '@leela/engine';

/** Where a saved game lives. Versioned: a shape change starts a new key. */
export const STORAGE_KEY = 'leela.game.v1';

/** The directions the engine can leave behind, plus "has not moved". */
const DIRECTIONS: ReadonlySet<string> = new Set<Direction | ''>([
  '',
  'step 🚶🏼',
  'snake 🐍',
  'arrow 🏹',
  'stop 🛑',
  'win 🕉',
]);

function isSquare(value: unknown, from: number): boolean {
  return Number.isInteger(value) && (value as number) >= from && (value as number) <= TOTAL_PLANS;
}

/**
 * Whether this could have come out of the engine.
 *
 * The consistency rule at the end is the one a field-by-field check misses:
 * `is_finished` is only ever set on the win square, before a game and after
 * one. A state claiming to be finished on plan 41 has no meaning — the app
 * would show "throw a six to enter" while a throw moved the player from 41.
 */
export function isSavedGame(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;

  if (!isSquare(state.loka, 1)) return false;
  if (!isSquare(state.previous_loka, 0)) return false;
  if (!isSquare(state.position_before_three_sixes, 0)) return false;
  if (typeof state.is_finished !== 'boolean') return false;
  if (typeof state.direction !== 'string' || !DIRECTIONS.has(state.direction)) return false;

  // 0, 1 or 2: a third six resets the run, so it is never stored.
  if (!Number.isInteger(state.consecutive_sixes)) return false;
  const sixes = state.consecutive_sixes as number;
  if (sixes < 0 || sixes > 2) return false;

  // Out of play means on the win square, and nowhere else.
  if (state.is_finished && state.loka !== WIN_LOKA) return false;

  return true;
}

/** Somewhere a game can be kept. `localStorage` is one; a Map is another. */
export interface GameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the saved game, or start a new one.
 *
 * Never throws. Storage can be disabled outright — a private window, a browser
 * with cookies blocked — and a game that cannot be saved should still be a game
 * that can be played.
 */
export function loadState(storage: GameStorage | undefined): GameState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed) ? parsed : initialState();
  } catch {
    return initialState();
  }
}

/**
 * Where the last throw lives.
 *
 * A key of its own rather than a field on the saved game: `isSavedGame` refuses
 * anything it does not recognise, so a value added inside would make every
 * existing save unreadable — a player's whole path dropped to remember a die.
 * Two keys can drift apart; the drift here is that the die shows a face nobody
 * threw, which is what it does now.
 */
export const DIE_KEY = 'leela.die.v1';

/**
 * The face to show when nothing has been thrown yet.
 *
 * Six, because that is `DiceStore.count`'s initial value in the published app,
 * and because a six is what a player needs to begin: the die at rest shows the
 * throw the game is waiting for.
 */
export const RESTING_FACE = 6;

/**
 * The last throw, as the die should show it.
 *
 * The mini app showed `1` on every load — hard-coded — so a player who threw a
 * six to move from 5 to 11, closed the app and came back was shown a one over a
 * board that had plainly moved by six. The die is a record of the throw, and a
 * record that resets is worse than no record.
 *
 * Anything that is not a face this die has is not restored. That is the rule,
 * rather than a list of the wrong values seen so far: a half-written string, a
 * `0` from an older shape and a `7` from a different game are all the same
 * answer.
 */
export function loadLastRoll(storage: GameStorage | undefined): number {
  try {
    const raw = storage?.getItem(DIE_KEY);
    const value = Number(raw);
    if (!raw || !Number.isInteger(value) || value < 1 || value > 6) return RESTING_FACE;
    return value;
  } catch {
    return RESTING_FACE;
  }
}

/** Keep the last throw. Forgetting it is a worse face, not a broken game. */
export function saveLastRoll(storage: GameStorage | undefined, value: number): void {
  try {
    storage?.setItem(DIE_KEY, String(value));
  } catch {
    // Same as the game itself: a window that cannot store still plays.
  }
}

/** Keep the game. A failure here is forgetfulness, not an error to show. */
export function saveState(storage: GameStorage | undefined, state: GameState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A private window with storage disabled still plays; it just forgets.
  }
}
