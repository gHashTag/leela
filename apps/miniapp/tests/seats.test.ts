import { describe, expect, it } from 'vitest';
import { CLASSIC, MAX_SEATS, advance, currentPlayer, initialState } from '@leela/engine';
import {
  SEATS_KEY,
  isSavedSeats,
  loadSeats,
  saveSeats,
  seatId,
  seatsFor,
  seatsFrom,
  sessionFrom,
} from '../src/seats';
import { STORAGE_KEY, type GameStorage } from '../src/state';

/**
 * Several people playing from one device.
 *
 * The published app has it — `SelectPlayersScreen` asks how many, up to six,
 * and `OfflinePlayers.store` keeps a plan and a history per seat. This app had
 * one player and one saved game.
 *
 * The rotation is not ported: `changePlayer` there is five hard-coded branches
 * over an array of who is still playing, and the engine has had that as
 * `nextSeat` all along. What is ported is the seating.
 */

function memory(initial?: string): GameStorage & { written: () => string | null } {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    written: () => value,
  };
}

/** A storage holding one key each, so a migration can be watched. */
function keyed(entries: Record<string, string>) {
  const held: Record<string, string> = { ...entries };
  return {
    storage: {
      getItem: (key: string) => held[key] ?? null,
      setItem: (key: string, value: string) => {
        held[key] = value;
      },
    } as GameStorage,
    held,
  };
}

describe('seating a table', () => {
  it('seats between one and six, as the app offers', () => {
    expect(seatsFor(1).players).toHaveLength(1);
    expect(seatsFor(MAX_SEATS).players).toHaveLength(MAX_SEATS);
  });

  it('holds any number to that range rather than refusing', () => {
    // A number from a tap is not a number from a person: clamp it.
    expect(seatsFor(0).players).toHaveLength(1);
    expect(seatsFor(-3).players).toHaveLength(1);
    expect(seatsFor(99).players).toHaveLength(MAX_SEATS);
    expect(seatsFor(2.7).players).toHaveLength(2);
  });

  it('starts everyone waiting for a six', () => {
    for (const seat of seatsFor(4).players) {
      expect(seat.state).toEqual(initialState());
      expect(seat.reportSubmitted).toBe(true);
    }
  });

  it('gives every seat a distinct id, so a journal can belong to one', () => {
    const ids = seatsFor(MAX_SEATS).players.map((seat) => seat.id);
    expect(new Set(ids).size).toBe(MAX_SEATS);
    expect(ids[0]).toBe(seatId(0));
  });
});

describe('a table that was already being played', () => {
  it('keeps the game that was saved before there were seats', () => {
    // The migration is the point: this app was played for weeks with one
    // player and one key, and a table that started empty would throw those
    // games away to add a feature nobody had asked for.
    const playing = {
      loka: 41,
      previous_loka: 37,
      direction: 'step 🚶🏼',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    };
    const { storage } = keyed({ [STORAGE_KEY]: JSON.stringify(playing) });

    const seats = loadSeats(storage);
    expect(seats.players).toHaveLength(1);
    expect(seats.players[0]?.state.loka).toBe(41);
  });

  it('starts a fresh table when there is nothing at all', () => {
    const seats = loadSeats(memory());
    expect(seats.players).toHaveLength(1);
    expect(seats.players[0]?.state).toEqual(initialState());
  });

  it('is written and read back as the same table', () => {
    const store = memory();
    const seats = seatsFor(3);
    saveSeats(store, seats);

    expect(loadSeats(memory(store.written() ?? undefined))).toEqual(seats);
  });

  it('refuses a table no game could have produced', () => {
    // Same rule `isSavedGame` follows: a shape that passes a state the engine
    // cannot reach is a shape check that hands the engine a lie.
    const good = seatsFor(2);
    expect(isSavedSeats(good)).toBe(true);

    for (const bad of [
      null,
      {},
      { turnIndex: 0, players: [] },
      { turnIndex: 0, players: Array.from({ length: MAX_SEATS + 1 }, () => good.players[0]) },
      { turnIndex: 5, players: good.players },
      { turnIndex: -1, players: good.players },
      { turnIndex: 0, players: [{ id: '', state: initialState(), reportSubmitted: true }] },
      { turnIndex: 0, players: [{ id: 'p1', state: { loka: 99 }, reportSubmitted: true }] },
    ]) {
      expect(isSavedSeats(bad), JSON.stringify(bad)?.slice(0, 40)).toBe(false);
    }
  });

  it('falls back rather than throwing on a stored value that is not a table', () => {
    const { storage } = keyed({ [SEATS_KEY]: 'not json' });
    expect(loadSeats(storage).players).toHaveLength(1);
  });
});

describe('the table and the engine', () => {
  it('round-trips through a session without losing a seat', () => {
    const seats = seatsFor(4);
    expect(seatsFrom(sessionFrom(seats))).toEqual(seats);
  });

  it('gives the engine the turn it was on', () => {
    const seats = { ...seatsFor(3), turnIndex: 2 };
    expect(currentPlayer(sessionFrom(seats)).id).toBe(seatId(2));
  });

  it('carries a played game back and forth', () => {
    // What a reload does: play, write it down, read it back, keep playing.
    let session = sessionFrom(seatsFor(2));
    session = advance(session, 6, 1_700_000_000_000).session;

    const written = seatsFrom(session);
    const reloaded = sessionFrom(written);

    expect(reloaded.players.map((player) => player.state)).toEqual(
      session.players.map((player) => player.state),
    );
    expect(currentPlayer(reloaded).id).toBe(currentPlayer(session).id);
  });

  it('plays by the engine rules, not by a copy of them', () => {
    // The whole reason the rotation is not ported: `advance` already knows
    // that a six keeps the seat under `classic`.
    const session = sessionFrom(seatsFor(3));
    const entry = advance(session, 6, 1_700_000_000_000);

    expect(entry.keepsTurn).toBe(true);
    expect(currentPlayer(entry.session).id).toBe(seatId(0));
    expect(CLASSIC.extraTurnOnSix).toBe(true);
  });
});
