/**
 * Whether a state somebody kept is one this engine could have produced.
 *
 * Four surfaces keep a game and read it back — `localStorage` in the mini app,
 * a file on the phone, two tables in the database — and each had written this
 * rule out by hand. Three of the four agreed. The fourth, `isSaved` in the
 * phone's `game-store.ts`, asked only that `state.loka` be a *number*, and it
 * is the one that ships to a device somebody owns.
 *
 * What that accepted, measured through the phone's own loader rather than
 * argued: plan 999 gave a board tile numbered 999 that no throw ever leaves;
 * plan 41.5 walked on to 47.5; `is_finished` on plan 41 drew no square at all
 * while still letting the player throw off it. A `turnIndex` of 7 at a table of
 * one was accepted by the loader and then thrown by everything that read it —
 * the tile, the throw gate, the move — which on a phone is the app failing to
 * start, over a file whose only correct answer was *begin again*.
 *
 * The engine's own header says it: **if you find yourself reimplementing a rule
 * outside this package, that rule belongs in here instead.** So it lives here
 * once, and the four readers ask it.
 *
 * Two answers to the same question, because the callers differ. The database
 * has to say *which* column it refuses — an operator holding a row needs the
 * name — and an app reading its own storage needs only yes or no, because the
 * answer to no is always the same: start again.
 */

import { TOTAL_PLANS, WIN_LOKA } from './board';
import { MAX_SEATS } from './session';
import type { Direction, GameState } from './types';

/**
 * `''` is a state that has not moved yet, and a row whose column was never
 * written. It is `GameState['direction']`'s own second half, not a gap.
 */
const DIRECTIONS: ReadonlySet<string> = new Set<Direction | ''>([
  '',
  'step 🚶🏼',
  'snake 🐍',
  'arrow 🏹',
  'stop 🛑',
  'win 🕉',
]);

/**
 * A whole number in a range, which is what every one of these fields holds.
 *
 * Exported because `packages/db` had it too, word for word, for the bounds its
 * rows carry that a state does not — a seat number, a turn index, a count of
 * rolls. Two copies of a guard agree until one of them learns something, and
 * the one that learns it is never the one the next reader is looking at.
 */
export function whole(value: unknown, from: number, to: number): boolean {
  return Number.isInteger(value) && (value as number) >= from && (value as number) <= to;
}

/**
 * Why this is not a state the engine could have reached, or null if it is.
 *
 * The sentence is the caller's to use: the database puts it in a
 * `StoredRowsError` beside the row, and an app throws the file away.
 */
export function whyNotPlayable(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'not a state at all';
  const state = value as Record<string, unknown>;

  if (!whole(state.loka, 1, TOTAL_PLANS)) return `plan ${String(state.loka)} is off the board`;
  if (!whole(state.previous_loka, 0, TOTAL_PLANS)) {
    return `previous plan ${String(state.previous_loka)} is off the board`;
  }
  if (!whole(state.position_before_three_sixes, 0, TOTAL_PLANS)) {
    return `fallback square ${String(state.position_before_three_sixes)} is off the board`;
  }

  // 0, 1 or 2: a third six resets the run, so a run of three is never stored.
  if (!whole(state.consecutive_sixes, 0, 2)) {
    return `a run of ${String(state.consecutive_sixes)} sixes cannot have been stored`;
  }

  if (typeof state.direction !== 'string' || !DIRECTIONS.has(state.direction)) {
    return `${JSON.stringify(state.direction)} is not a direction`;
  }

  if (typeof state.is_finished !== 'boolean') return 'is_finished is not a boolean';

  // Out of play means on the win square and nowhere else — the engine only ever
  // sets the flag there. "Finished on plan 41" is not a game.
  if (state.is_finished && state.loka !== WIN_LOKA) {
    return `finished on plan ${String(state.loka)}, which is not the win square`;
  }

  return null;
}

/** Whether this is a state the engine could have produced. */
export function isPlayableState(value: unknown): value is GameState {
  return whyNotPlayable(value) === null;
}

/**
 * Why this is not a table the engine could have produced, or null if it is.
 *
 * The turn index is the field an app forgets and the database learned to
 * refuse: it points into `players`, and one past the end points at nobody, so
 * every reader of the table throws instead of the one that is wrong.
 *
 * `rules` is deliberately not judged here. A stored variant is a name, checked
 * against `isRuleSetId` and rebuilt with `ruleSetById` by whoever loads it —
 * trusting a serialised rule *object* is how a saved file quietly plays a
 * different game, which is a defect of its own and not a shape.
 */
export function whyNotSeated(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'not a table at all';
  const table = value as { players?: unknown; turnIndex?: unknown; rollCount?: unknown };

  if (!Array.isArray(table.players)) return 'has no seats';
  if (table.players.length < 1) return 'a table with no players';
  if (table.players.length > MAX_SEATS) {
    return `${table.players.length} players at a table of ${MAX_SEATS}`;
  }

  if (!whole(table.turnIndex, 0, table.players.length - 1)) {
    return `turn ${String(table.turnIndex)} at a table of ${table.players.length}`;
  }

  // Checked where it is written and not required. The mini app's saved table
  // has no such field, and demanding one would refuse every game saved before
  // this line existed — a player's whole path dropped to tighten a check.
  if (table.rollCount !== undefined && !whole(table.rollCount, 0, Number.MAX_SAFE_INTEGER)) {
    return `${String(table.rollCount)} rolls taken`;
  }

  for (const [at, seat] of table.players.entries()) {
    if (typeof seat !== 'object' || seat === null) return `seat ${at} is not a player`;
    const one = seat as { id?: unknown; reportSubmitted?: unknown; state?: unknown };

    if (typeof one.id !== 'string' || one.id.length === 0) return `seat ${at} has no id`;
    if (typeof one.reportSubmitted !== 'boolean') {
      return `seat ${at}: report_submitted is not a boolean`;
    }

    const why = whyNotPlayable(one.state);
    if (why !== null) return `seat ${at} (${one.id}): ${why}`;
  }

  return null;
}

/** Whether this is a table the engine could have produced. */
export function isSeatedTable(value: unknown): boolean {
  return whyNotSeated(value) === null;
}
