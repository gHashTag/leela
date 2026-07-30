/**
 * Several people playing from one device.
 *
 * The published app has this and this app did not: `SelectPlayersScreen` asks
 * how many, `DiceStore.multi` holds the answer, and `OfflinePlayers.store`
 * keeps a plan and a history per seat. Six is the most, which is `MAX_SEATS`
 * here too.
 *
 * The turn rotation there is `changePlayer`, five hard-coded branches over an
 * array of who is still playing:
 *
 * ```ts
 * } else if (newArr.indexOf(true) === 2) {
 *   DiceStore.players = DiceStore.multi - lengthArray + 3
 * } else if (newArr.indexOf(true) === 3) {
 * ```
 *
 * That is "the next seat still in play, wrapping" written out longhand, and the
 * engine already has it as `nextSeat`. So this file does not port the
 * rotation — it ports the *seating*, and lets `advance` do what it already does
 * correctly for the bot.
 *
 * What is stored is the seats, not the `Session`: a `RuleSet` is code and has
 * no business in `localStorage`, and a saved game that carried one would be a
 * saved game that could disagree with the engine it is loaded into.
 */

import {
  CLASSIC,
  MAX_SEATS,
  createSession,
  initialState,
  type GameState,
  type SeatedPlayer,
  type Session,
} from '@leela/engine';
import { isSavedGame, loadState, type GameStorage } from './state';

/** Where the seated game lives. A shape change starts a new key. */
export const SEATS_KEY = 'leela.seats.v1';

/** One seat, as it is written down. */
export interface SavedSeat {
  id: string;
  state: GameState;
  reportSubmitted: boolean;
}

/** The table, as it is written down. */
export interface SavedSeats {
  turnIndex: number;
  players: SavedSeat[];
}

/** Seat ids, so a journal can be kept per player and survive a reload. */
export function seatId(index: number): string {
  return `p${index + 1}`;
}

/**
 * Whether this is a table the engine could have produced.
 *
 * The same rule `isSavedGame` follows: a shape check that lets a state through
 * which no game reaches is a shape check that hands the engine a lie.
 */
export function isSavedSeats(value: unknown): value is SavedSeats {
  if (typeof value !== 'object' || value === null) return false;

  const table = value as { turnIndex?: unknown; players?: unknown };
  if (!Array.isArray(table.players)) return false;
  if (table.players.length < 1 || table.players.length > MAX_SEATS) return false;

  if (!Number.isInteger(table.turnIndex)) return false;
  const turn = table.turnIndex as number;
  if (turn < 0 || turn >= table.players.length) return false;

  return table.players.every((seat: unknown) => {
    if (typeof seat !== 'object' || seat === null) return false;
    const one = seat as { id?: unknown; state?: unknown; reportSubmitted?: unknown };
    return (
      typeof one.id === 'string' &&
      one.id.length > 0 &&
      typeof one.reportSubmitted === 'boolean' &&
      isSavedGame(one.state)
    );
  });
}

/**
 * The table, or one seat holding whatever single game was already saved.
 *
 * The migration is the point: this app has been played for weeks with one
 * player and one key, and a table that started empty would throw those games
 * away to add a feature nobody had asked for yet.
 */
export function loadSeats(storage: GameStorage | undefined): SavedSeats {
  try {
    const raw = storage?.getItem(SEATS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isSavedSeats(parsed)) return parsed;
    }
  } catch {
    // A table that cannot be read is a table to start again, not a crash.
  }

  return {
    turnIndex: 0,
    players: [{ id: seatId(0), state: loadState(storage), reportSubmitted: true }],
  };
}

/** Keep the table. Forgetting it is a lost game, not an error to show. */
export function saveSeats(storage: GameStorage | undefined, seats: SavedSeats): void {
  try {
    storage?.setItem(SEATS_KEY, JSON.stringify(seats));
  } catch {
    // A private window still plays; it just forgets.
  }
}

/** The engine's session for this table. */
export function sessionFrom(seats: SavedSeats): Session {
  const session = createSession(
    'device',
    seats.players.map((seat) => ({ id: seat.id })),
    CLASSIC,
  );

  return {
    ...session,
    turnIndex: seats.turnIndex,
    players: session.players.map((player, index) => ({
      ...player,
      state: seats.players[index]?.state ?? player.state,
      reportSubmitted: seats.players[index]?.reportSubmitted ?? true,
    })),
  };
}

/** The table, as it is written down, from the session it was played in. */
export function seatsFrom(session: Session): SavedSeats {
  return {
    turnIndex: session.turnIndex,
    players: session.players.map((player: SeatedPlayer) => ({
      id: player.id,
      state: player.state,
      reportSubmitted: player.reportSubmitted,
    })),
  };
}

/**
 * Change how many are playing, without ending the game of anyone who stays.
 *
 * Choosing a number used to build a fresh table: every seat back to the waiting
 * square, whatever was on the board thrown away. A game thirty days old, a
 * player on plan 41, and one tap on the players button with no question asked
 * and nothing said about it — the count is a live control, offered at any
 * moment, and the published app asks the same question once, before play, on a
 * screen of its own.
 *
 * Somebody joining is not a reason for everybody to start again. So the seats
 * that stay are kept exactly as they are, and only the ones being made are new.
 * Shrinking is the player saying those seats are not playing; their journals
 * live under their own keys and are still there if they sit down again.
 *
 * Returns the seats that were *created*, so the caller can clear what a seat of
 * that name left behind last time — a draft under `p2` from a table before this
 * one would otherwise surface as somebody else's half-sentence.
 */
export function resize(
  seats: SavedSeats,
  count: number,
): { seats: SavedSeats; created: string[] } {
  const wanted = Math.min(Math.max(Math.trunc(count) || 1, 1), MAX_SEATS);
  const kept = seats.players.slice(0, wanted);
  const created = Array.from({ length: wanted - kept.length }, (_, index) => ({
    id: seatId(kept.length + index),
    state: initialState(),
    reportSubmitted: true,
  }));

  const players = [...kept, ...created];

  return {
    seats: {
      // The turn has to point at somebody who is still at the table. Whoever
      // held it keeps it; if their seat has gone, it goes back to the first.
      turnIndex: seats.turnIndex < players.length ? seats.turnIndex : 0,
      players,
    },
    created: created.map((seat) => seat.id),
  };
}
