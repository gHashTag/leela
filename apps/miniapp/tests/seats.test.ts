import { describe, expect, it } from 'vitest';
import { CLASSIC, MAX_SEATS, advance, currentPlayer, initialState } from '@leela/engine';
import {
  SEATS_KEY,
  isSavedSeats,
  loadSeats,
  resize,
  saveSeats,
  seatId,
  seatsFrom,
  sessionFrom,
  type SavedSeat,
  type SavedSeats,
} from '../src/seats';
import { STORAGE_KEY, type GameStorage } from '../src/state';

/** A table of `count` seats and nothing else — what `resize` makes from none. */
function fresh(count: number): SavedSeats {
  return resize({ turnIndex: 0, players: [] }, count).seats;
}


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
    expect(fresh(1).players).toHaveLength(1);
    expect(fresh(MAX_SEATS).players).toHaveLength(MAX_SEATS);
  });

  it('holds any number to that range rather than refusing', () => {
    // A number from a tap is not a number from a person: clamp it.
    expect(fresh(0).players).toHaveLength(1);
    expect(fresh(-3).players).toHaveLength(1);
    expect(fresh(99).players).toHaveLength(MAX_SEATS);
    expect(fresh(2.7).players).toHaveLength(2);
  });

  it('starts everyone waiting for a six', () => {
    for (const seat of fresh(4).players) {
      expect(seat.state).toEqual(initialState());
      expect(seat.reportSubmitted).toBe(true);
    }
  });

  it('gives every seat a distinct id, so a journal can belong to one', () => {
    const ids = fresh(MAX_SEATS).players.map((seat) => seat.id);
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
    const seats = fresh(3);
    saveSeats(store, seats);

    expect(loadSeats(memory(store.written() ?? undefined))).toEqual(seats);
  });

  it('refuses a table no game could have produced', () => {
    // Same rule `isSavedGame` follows: a shape that passes a state the engine
    // cannot reach is a shape check that hands the engine a lie.
    const good = fresh(2);
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
    const seats = fresh(4);
    expect(seatsFrom(sessionFrom(seats))).toEqual(seats);
  });

  it('gives the engine the turn it was on', () => {
    const seats = { ...fresh(3), turnIndex: 2 };
    expect(currentPlayer(sessionFrom(seats)).id).toBe(seatId(2));
  });

  it('carries a played game back and forth', () => {
    // What a reload does: play, write it down, read it back, keep playing.
    let session = sessionFrom(fresh(2));
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
    const session = sessionFrom(fresh(3));
    const entry = advance(session, 6, 1_700_000_000_000);

    expect(entry.keepsTurn).toBe(true);
    expect(currentPlayer(entry.session).id).toBe(seatId(0));
    expect(CLASSIC.extraTurnOnSix).toBe(true);
  });
});

describe('changing how many are playing', () => {
  /**
   * Choosing a number used to build a fresh table.
   *
   * Every seat back to the waiting square, whatever was on the board thrown
   * away — a game thirty days old, a player on plan 41, one tap on the players
   * button, nothing asked and nothing said. Found by tapping it, which is the
   * fourth defect in a row found that way and the third of one shape: an act
   * whose only guard was the drawing of a control.
   *
   * Somebody joining is not a reason for everybody to start again. The rule is
   * therefore not about counts at all: **no seat that stays loses its game.**
   */
  const playing = (loka: number): SavedSeat['state'] => ({
    loka,
    previous_loka: loka - 6,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  });

  const table = (...plans: number[]): SavedSeats => ({
    turnIndex: 0,
    players: plans.map((loka, index) => ({
      id: seatId(index),
      state: playing(loka),
      reportSubmitted: index % 2 === 0,
    })),
  });

  it('leaves every seat that stays exactly as it was', () => {
    // Over every size a table can be, in both directions: whoever is still at
    // the table is still where they were, still owing or not owing what they
    // did. Nothing about them may change because somebody else arrived.
    const before = table(41, 12, 3, 68, 9, 30);

    for (let from = 1; from <= MAX_SEATS; from++) {
      const start = { ...before, players: before.players.slice(0, from) };

      for (let to = 1; to <= MAX_SEATS; to++) {
        const { seats } = resize(start, to);

        for (let index = 0; index < Math.min(from, to); index++) {
          expect(seats.players[index], `${from} → ${to}, seat ${index + 1}`).toEqual(
            start.players[index],
          );
        }
      }
    }
  });

  it('seats the new ones waiting to enter, as a player who has not begun is', () => {
    const { seats, created } = resize(table(41), 3);

    expect(created).toEqual(['p2', 'p3']);
    for (const id of created) {
      const made = seats.players.find((seat) => seat.id === id);
      expect(made?.state, id).toEqual(initialState());
      expect(made?.reportSubmitted, id).toBe(true);
    }
  });

  it('says which seats it made, and none that it kept', () => {
    // The caller clears what a seat of that name left behind last time. Naming
    // a seat that stayed would wipe the draft of somebody still playing.
    expect(resize(table(41, 12, 3), 1).created).toEqual([]);
    expect(resize(table(41), 1).created).toEqual([]);
    expect(resize(table(41), 6).created).toEqual(['p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('always leaves the turn pointing at somebody who is there', () => {
    for (let from = 1; from <= MAX_SEATS; from++) {
      for (let holder = 0; holder < from; holder++) {
        const start = { turnIndex: holder, players: table(41, 12, 3, 68, 9, 30).players.slice(0, from) };

        for (let to = 1; to <= MAX_SEATS; to++) {
          const { seats } = resize(start, to);
          expect(seats.turnIndex, `${from}@${holder} → ${to}`).toBeGreaterThanOrEqual(0);
          expect(seats.turnIndex, `${from}@${holder} → ${to}`).toBeLessThan(seats.players.length);
        }
      }
    }
  });

  it('keeps the turn where it was whenever that seat is still there', () => {
    const start = { turnIndex: 1, players: table(41, 12, 3).players };
    expect(resize(start, 3).seats.turnIndex).toBe(1);
    expect(resize(start, 2).seats.turnIndex).toBe(1);
    // The seat holding the turn has gone, so it goes back to the first.
    expect(resize(start, 1).seats.turnIndex).toBe(0);
  });

  it('refuses to seat nobody, or more than the board allows', () => {
    for (const asked of [0, -3, 7, 99, Number.NaN]) {
      const { seats } = resize(table(41), asked);
      expect(seats.players.length, String(asked)).toBeGreaterThanOrEqual(1);
      expect(seats.players.length, String(asked)).toBeLessThanOrEqual(MAX_SEATS);
    }
  });

  it('is a table the app can read back', () => {
    // Whatever it builds has to survive the validator, or the next load throws
    // the game away for a different reason.
    for (let to = 1; to <= MAX_SEATS; to++) {
      expect(isSavedSeats(resize(table(41, 12), to).seats), String(to)).toBe(true);
    }
  });
});
