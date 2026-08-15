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

import {
  MAX_SEATS,
  hasWon,
  isPlayableState,
  whyNotPlayable,
  type GameState,
  type RuleSet,
} from '@leela/engine';

import { areRolls, stateAfter } from './path';

export const KEPT_KEY = 'leela.webgl.game';

/** One seat of a saved table. */
export interface KeptSeat {
  readonly id: string;
  /** Which deity this seat plays. Validated by `deityFor`, not here. */
  readonly deity: string;
  readonly state: GameState;
  readonly rolls: readonly number[];
}

export interface Kept {
  /** Every seat, in seating order. */
  readonly seats: readonly KeptSeat[];
  /** Index into `seats` of whoever holds the turn. */
  readonly turnIndex: number;
  /**
   * Index into `seats` of whoever threw last, or null before anyone has.
   *
   * Stored rather than derived, and that is the point. The die shows the throw
   * that just happened, so restoring its face needs to know whose throw it was
   * — and after a non-six the turn has already moved on, so the seat holding
   * the turn is *not* the one that threw. Deriving it from `turnIndex` and the
   * tails of each seat's rolls would mean re-implementing `grantsExtraTurn` and
   * `keepsTurn` in this surface, and would still be undecidable for a record
   * this app did not write.
   */
  readonly lastThrower: number | null;
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
  /**
   * The table to resume, empty when there is none.
   *
   * A record written before seating existed has one `state` at the top level
   * and no seats; it is read as a table of one, because a player who has walked
   * forty squares should not lose them to a shape change. That is the whole of
   * the migration and it is one branch — the alternative, bumping a version and
   * refusing the old shape, throws away exactly the games worth keeping.
   */
  readonly seats: readonly KeptSeat[];
  /** Whose turn, an index into `seats`. Zero when there is no table. */
  readonly turnIndex: number;
  /**
   * Who threw last, or null when that is not known.
   *
   * Null rather than zero, unlike `turnIndex`. A turn has to belong to
   * somebody, so falling back to the first seat is right there; a *throw* need
   * not have happened at all, and falling back to seat one would put seat one's
   * number on the die as though they had just thrown it.
   */
  readonly lastThrower: number | null;
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

const NOTHING: Reading = { seats: [], turnIndex: 0, lastThrower: null, deity: null, why: null };

/** A deity id off a record, or null. Never validated here — `deityFor` does. */
const deityOf = (record: { deity?: unknown }): string | null =>
  typeof record.deity === 'string' && record.deity.length > 0 ? record.deity : null;

/**
 * @param rules the ruleset the surface plays.
 *
 * Not defaulted. `stateAfter` takes `DEFAULT_RULESET` when nobody says, and
 * this was the one call site in the app that did not say — so a history played
 * under `LEGACY_MOBILE` was being checked against `NEUROLEELA`, which differs
 * from it in nine fields including `extraTurnOnSix` and `rerollOnRepeat`. It is
 * not a near-miss between neighbouring variants; it is a replay of a different
 * game. Measured over five thousand random forty-throw games, 46.9% of them
 * reach a different square under the two, and every one of those loses its
 * whole history on reload while keeping its square — the player comes back
 * standing where they were with an empty path and nothing said.
 */
export function read(store: Store | null, rules: RuleSet): Reading {
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
    return { ...NOTHING, why: 'the saved game is not readable' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ...NOTHING, why: 'the saved game is not readable' };
  }

  const record = parsed as {
    state?: unknown;
    deity?: unknown;
    rolls?: unknown;
    seats?: unknown;
    turnIndex?: unknown;
  };
  const deity = deityOf(record);

  /**
   * One seat, read.
   *
   * The state is what the engine last produced and the rolls are what produced
   * it, so replaying the rolls has to land on the stored square. When it does
   * not, one of them is from a different game — a `RuleSet` changed under a
   * saved file, a record edited by hand — and playing on from a state whose
   * history says something else is how a path silently becomes fiction. The
   * seat is kept, because the state is what you are standing on; its history is
   * dropped, because it is the part that is provably wrong.
   */
  const seatFrom = (
    value: unknown,
    fallbackId: string,
    fallbackDeity: string | null,
  ): { seat: KeptSeat | null; why: string | null } => {
    const row = (value ?? {}) as { id?: unknown; deity?: unknown; state?: unknown; rolls?: unknown };

    const why = whyNotPlayable(row.state);
    if (why !== null || !isPlayableState(row.state)) {
      return { seat: null, why: why ?? 'the saved game is not a game' };
    }

    // A history that is not a list of throws is dropped and the seat is kept:
    // losing where you have been is a loss, losing the game as well is two.
    const rolls = areRolls(row.rolls) ? row.rolls : [];
    const leads = rolls.length === 0 || stateAfter(rolls, rules).loka === row.state.loka;

    return {
      seat: {
        id: typeof row.id === 'string' && row.id.length > 0 ? row.id : fallbackId,
        deity:
          typeof row.deity === 'string' && row.deity.length > 0 ? row.deity : (fallbackDeity ?? ''),
        state: row.state,
        rolls: leads ? rolls : [],
      },
      why: leads ? null : 'the saved history does not lead to the saved square',
    };
  };

  // A record from before seating: one `state` at the top and no seats. Read as
  // a table of one rather than refused, because a player forty squares in
  // should not lose them to a shape change.
  const stored = Array.isArray(record.seats)
    ? record.seats
    : [{ id: 'p1', deity: record.deity, state: record.state, rolls: record.rolls }];

  /**
   * No more seats than the engine will seat.
   *
   * `createSession` refuses a table outside 1..`MAX_SEATS`, and the caller caps
   * the table it builds — but this used to report every seat it found and
   * clamp the turn against *that*, so a record with more seats than the game
   * allows produced a turn belonging to a seat nobody would be sitting in. The
   * engine's `currentPlayer` throws rather than returning undefined, so the
   * page died before it drew a frame. Not a wrong readout: a blank screen.
   *
   * Nothing this app writes can reach here — `seatTable` caps at `MAX_SEATS`
   * before saving. Another version of another surface, or a hand-edited
   * record, can.
   */
  const rows = stored.slice(0, MAX_SEATS);

  const seats: KeptSeat[] = [];
  let trouble: string | null =
    stored.length > MAX_SEATS ? `the saved table seats more than ${MAX_SEATS}` : null;
  for (const [at, row] of rows.entries()) {
    const read = seatFrom(row, `p${at + 1}`, deity);
    if (read.why !== null) trouble ??= read.why;
    if (read.seat) seats.push(read.seat);
  }

  if (seats.length === 0) return { seats: [], turnIndex: 0, lastThrower: null, deity, why: trouble };

  const turn = Number.isInteger(record.turnIndex) ? (record.turnIndex as number) : 0;
  // Refused rather than clamped, which is the opposite of `turnIndex` above and
  // deliberately so: an unusable turn falls back to the first seat because
  // somebody must hold it, while an unusable last-thrower falls back to nobody,
  // because putting seat one's number on the die would be this surface claiming
  // a throw that may never have happened.
  const thrower = (record as { lastThrower?: unknown }).lastThrower;
  const threw =
    Number.isInteger(thrower) && (thrower as number) >= 0 && (thrower as number) < seats.length
      ? (thrower as number)
      : null;

  return {
    seats,
    // Clamped rather than trusted: a turn index past the end of the table is a
    // table nobody can play, and it is one arithmetic slip in another version.
    turnIndex: turn >= 0 && turn < seats.length ? turn : 0,
    lastThrower: threw,
    deity,
    why: trouble,
  };
}

/**
 * True of a table nobody can move in: every seat has won.
 *
 * `read` hands such a table back rather than refusing it — a finished game is
 * not a corrupt one, and refusing it would cost the seats their count and the
 * player a `gameNotRead` sentence about a game that read perfectly well. But
 * the engine refuses to *play* it: `advance` throws at a session that is over,
 * so a boot that seats this table as-is hands that throw to the first tap of
 * the die. The caller reseats instead, which is the same answer the winning
 * arm gives when the last seat finishes live. Nothing this app writes can
 * reach it — the winning arm reseats before `keep` runs — but a hand-edited
 * record or another surface's can.
 *
 * Two traps are load-bearing here, and each has a test that fails without it.
 * A seat still waiting to enter also sits on 68 with `is_finished` set —
 * `hasWon` is what tells a winner from a player who has never rolled, and a
 * check on the flag alone calls a table nobody has entered finished. And
 * `every` over an empty list is true, while a table with nobody at it is a
 * fresh boot, not an ended game.
 */
export const finishedTable = (seats: readonly KeptSeat[]): boolean =>
  seats.length > 0 && seats.every((seat) => hasWon(seat.state));

/**
 * Whether the table is now on disk.
 *
 * A game that cannot be saved is still a game being played — but the caller is
 * the only one who can say so, and it cannot say what it was never told. The
 * mini app's `saveJournal` walked exactly this road: it swallowed the refusal,
 * its test asserted it did not throw, and behind that assertion the app
 * answered "Written." over writing that was gone.
 */
export function write(store: Store | null, kept: Kept): boolean {
  if (!store) return false;
  try {
    store.setItem(KEPT_KEY, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

/** Whether the record is now gone — false, and it will be back next load. */
export function forget(store: Store | null): boolean {
  if (!store) return true;
  try {
    store.removeItem(KEPT_KEY);
    return true;
  } catch {
    return false;
  }
}
