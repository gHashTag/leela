/**
 * What survives a reload.
 *
 * Leela is a game about a journey, and a journey that restarts every time a
 * phone locks is not one. This surface remembered exactly one thing — which
 * deity you had picked — so a player forty squares in who backgrounded the tab
 * came back to square one and no explanation.
 *
 * Three rules, and each is a defect this repository has already paid for once:
 *
 *   - **The engine decides what a game is.** `whyNotPlayable` already knows
 *     every way a stored state can be wrong and says which one, so nothing here
 *     re-checks a square number or a direction. A second validator is a second
 *     list to keep.
 *   - **A record that cannot be read is reported, not swallowed.** A restore
 *     that quietly starts a new game is indistinguishable from never having
 *     saved, which is how a broken save survives for months. `read` returns the
 *     reason beside the absence — absent is not zero.
 *   - **Storage is allowed to refuse.** `localStorage` throws rather than
 *     returning null in a browser with storage blocked; Safari's private mode
 *     did this for years. A game that will not open because it could not
 *     remember is worse than a game that forgets.
 */

import { isPlayableState, whyNotPlayable, type GameState } from '@leela/engine';

import { areRolls, stateAfter } from './path';

export const KEPT_KEY = 'leela.webgl.game';

export interface Kept {
  readonly state: GameState;
  /** Which deity was playing. Validated by `deityFor`, not here. */
  readonly deity: string;
  /**
   * Every throw of this game, in order.
   *
   * The history is the *rolls*, not the squares: `replay` turns them back into
   * every move they produced, so the path is derived and cannot disagree with
   * the rules. A stored list of squares would be a second account of the game,
   * and a second account goes wrong the first time a `RuleSet` changes.
   */
  readonly rolls: readonly number[];
}

/**
 * Storage, as this needs it.
 *
 * Structural, so a test can be one and so the caller owns the decision about
 * which storage to use. `Storage` itself carries `length`, `key` and an index
 * signature that a stub would have to invent.
 */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The real one, or null where the browser refuses to hand it over. */
export const browserStore = (): Store | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export interface Reading {
  /** The game to resume, or null. */
  readonly state: GameState | null;
  /**
   * Who was playing, if the record named anyone — **even when the game itself
   * was refused**.
   *
   * The two are independent, and reading them as one cost a player their deity
   * every time a board failed to load. Worse, the sentence shown at that moment
   * promises that what is not the board has been left alone, so the screen said
   * one thing and the roster said another. A corrupt game is not a reason to
   * forget who you are.
   */
  readonly deity: string | null;
  /** Every throw of the resumed game, or empty. */
  readonly rolls: readonly number[];
  /**
   * Why there is no game, when there was something stored and it was refused.
   *
   * Null both when a game was read and when nothing had been stored at all —
   * those are the two cases with nothing to explain. A non-null reason always
   * means *something was there and it was not usable*, which is the case worth
   * telling a player about.
   */
  readonly why: string | null;
}

const NOTHING: Reading = { state: null, deity: null, rolls: [], why: null };

/** A deity id off a record, or null. Never validated here — `deityFor` does. */
const deityOf = (record: { deity?: unknown }): string | null =>
  typeof record.deity === 'string' && record.deity.length > 0 ? record.deity : null;

export function read(store: Store | null): Reading {
  if (!store) return NOTHING;

  let raw: string | null;
  try {
    raw = store.getItem(KEPT_KEY);
  } catch {
    // Reading can throw too, on a storage that is present and disabled.
    return NOTHING;
  }
  if (raw === null) return NOTHING;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: null, deity: null, rolls: [], why: 'the saved game is not readable' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { state: null, deity: null, rolls: [], why: 'the saved game is not readable' };
  }

  const record = parsed as { state?: unknown; deity?: unknown; rolls?: unknown };
  const deity = deityOf(record);

  const why = whyNotPlayable(record.state);
  if (why !== null || !isPlayableState(record.state)) {
    return { state: null, deity, rolls: [], why: why ?? 'the saved game is not a game' };
  }

  // A history that is not a list of throws is dropped, and the game is kept.
  // Losing where you have been is a loss; losing the game as well would be two.
  const rolls = areRolls(record.rolls) ? record.rolls : [];

  /**
   * The two have to agree.
   *
   * The state is what the engine last produced and the rolls are what produced
   * it, so replaying the rolls has to land on the stored square. When it does
   * not, one of them is from a different game — a `RuleSet` that changed under
   * a saved file, or a record edited by hand — and playing on from a state
   * whose history says something else is how a path silently becomes fiction.
   * The game is kept, because the state is the thing you are standing on; the
   * history is dropped, because it is the part that is provably wrong.
   */
  const consistent = rolls.length === 0 || stateAfter(rolls).loka === record.state.loka;

  return {
    state: record.state,
    deity,
    rolls: consistent ? rolls : [],
    why: consistent ? null : 'the saved history does not lead to the saved square',
  };
}

export function write(store: Store | null, kept: Kept): void {
  if (!store) return;
  try {
    store.setItem(KEPT_KEY, JSON.stringify(kept));
  } catch {
    /* A game that cannot be saved is still a game being played. */
  }
}

export function forget(store: Store | null): void {
  if (!store) return;
  try {
    store.removeItem(KEPT_KEY);
  } catch {
    /* Nothing to do, and nothing worth stopping the game for. */
  }
}
