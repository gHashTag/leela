/**
 * A table of three, refused whole, offered back as somebody else's game.
 *
 * `loadSeats` asked `isSavedSeats` about the entire table and threw all of it
 * away on any single fault. Measured on this browser before anything changed —
 * three players on plans 41, 23 and 7, one seat damaged:
 *
 *   in the file        3 seats, on 41, 23 and 7
 *   read into the app  1 seat, on plan 12
 *   after one throw    1 seat, on plan 12, on the disk
 *
 * Plan 12 was never at that table. It came from `leela.game.v1`, the key this
 * app used before there were seats, which the fallback resurrects — so two
 * players vanished and the third was handed a stranger's square as though it
 * were their own, with nothing said and the overwrite one throw away. A stale
 * `turnIndex` did the same thing with every seat in the file intact.
 *
 * Two rules are asserted here, and neither is "three seats survive one bad
 * one":
 *
 *   1. **Nothing that can be kept is lost.** For any table the app itself
 *      wrote, everything readable in the file comes back — including when the
 *      only fault is the turn, which points into the table rather than being
 *      part of it.
 *   2. **What cannot be kept is counted.** Seats read plus seats reported is
 *      seats in the file, so a table that came back short cannot be mistaken
 *      for a table that was never that wide.
 */

import { describe, expect, it } from 'vitest';
import { MAX_SEATS, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { SEATS_KEY, readSeats, saveSeats, seatsFrom, sessionFrom } from '../src/seats';
import { STORAGE_KEY } from '../src/state';

const stateOn = (loka: number, over: Record<string, unknown> = {}) => ({
  loka,
  previous_loka: Math.max(0, loka - 3),
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
  ...over,
});

const seatOn = (id: string, loka: number) => ({
  id,
  state: stateOn(loka),
  reportSubmitted: true,
});

/** Seats no reader accepts, one of each shape a seat can be wrong in. */
const unreadable: unknown[] = [
  { id: 'x', state: stateOn(900), reportSubmitted: true },
  { id: 'x', state: stateOn(0), reportSubmitted: true },
  { id: 'x', state: stateOn(TOTAL_PLANS + 1), reportSubmitted: true },
  { id: 'x', state: stateOn(41.5), reportSubmitted: true },
  { id: 'x', state: stateOn(41, { is_finished: true }), reportSubmitted: true },
  { id: 'x', state: stateOn(10, { consecutive_sixes: 3 }), reportSubmitted: true },
  { id: 'x', state: stateOn(10, { direction: 'sideways' }), reportSubmitted: true },
  { id: '', state: stateOn(10), reportSubmitted: true },
  { id: 'x', state: stateOn(10), reportSubmitted: 'yes' },
  { id: 'x', reportSubmitted: true },
  'not a seat',
  null,
];

function browser(before: Record<string, unknown> = {}) {
  const held = new Map<string, string>();
  for (const [key, value] of Object.entries(before)) held.set(key, JSON.stringify(value));

  return {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => {
      held.set(key, value);
    },
    onDisk: (key = SEATS_KEY) => JSON.parse(held.get(key) ?? 'null') as { players: unknown[] } | null,
  };
}

/** The pre-seats game, so the fallback has something to resurrect. */
const olderGame = { [STORAGE_KEY]: stateOn(12) };

describe('a table read back off the browser', () => {
  it('accounts for every seat that was written', () => {
    const unaccounted: string[] = [];

    for (let bad = 0; bad <= unreadable.length; bad += 1) {
      for (const good of [0, 1, 3, MAX_SEATS]) {
        const players = [
          ...Array.from({ length: good }, (_, at) => seatOn(`p${at + 1}`, at * 7 + 1)),
          ...unreadable.slice(0, bad),
        ];

        const store = browser({ ...olderGame, [SEATS_KEY]: { turnIndex: 0, players } });
        const back = readSeats(store);

        // With nothing readable the table falls back to the older single game,
        // which is one seat this file did not hold — so the sum is over what
        // the file had, and every unreadable seat is still counted.
        const kept = good === 0 ? 0 : back.seats.players.length;
        if (kept + back.dropped !== players.length) {
          unaccounted.push(
            `${good} readable and ${bad} not: ${kept} kept, ${back.dropped} reported, ` +
              `${players.length} written`,
          );
        }
      }
    }

    expect(unaccounted).toEqual([]);
  });

  it('keeps the seats it can read, with the ids their journals are under', () => {
    // The ids are not renumbered. `leela.reports.v1.p3` belongs to p3, and a
    // survivor renamed to p2 would be handed somebody else's writing.
    const store = browser({
      ...olderGame,
      [SEATS_KEY]: {
        turnIndex: 1,
        players: [seatOn('p1', 41), unreadable[0], seatOn('p3', 7)],
      },
    });

    const back = readSeats(store);

    expect(back.dropped).toBe(1);
    expect(back.seats.players.map((seat) => seat.id)).toEqual(['p1', 'p3']);
    expect(back.seats.players.map((seat) => seat.state.loka)).toEqual([41, 7]);
  });

  it('repairs a turn that points at nobody without losing a single seat', () => {
    // The turn points into the table; it is not one of its facts. `resize`
    // already clamps it for this reason, and refusing the table over it threw
    // away three intact games.
    for (const turnIndex of [3, 9, -1, 0.5, '1', null, undefined]) {
      const store = browser({
        ...olderGame,
        [SEATS_KEY]: { turnIndex, players: [seatOn('p1', 41), seatOn('p2', 23), seatOn('p3', 7)] },
      });

      const back = readSeats(store);

      expect({ wrote: turnIndex, read: back.seats.turnIndex, seats: back.seats.players }).toEqual({
        wrote: turnIndex,
        read: 0,
        seats: [seatOn('p1', 41), seatOn('p2', 23), seatOn('p3', 7)],
      });
      expect(back.dropped).toBe(0);
    }
  });

  it('keeps a turn that names somebody', () => {
    const store = browser({
      ...olderGame,
      [SEATS_KEY]: { turnIndex: 2, players: [seatOn('p1', 41), seatOn('p2', 23), seatOn('p3', 7)] },
    });

    expect(readSeats(store).seats.turnIndex).toBe(2);
  });

  it('does not destroy the survivors when the next throw is kept', () => {
    // The permanent half: the app writes back what it is holding, so anything
    // the read dropped is off the disk one throw later.
    const store = browser({
      ...olderGame,
      [SEATS_KEY]: {
        turnIndex: 9,
        players: [seatOn('p1', 41), seatOn('p2', 23), seatOn('p3', 7)],
      },
    });

    const back = readSeats(store);
    saveSeats(store, seatsFrom(sessionFrom(back.seats)));

    expect(store.onDisk()?.players).toHaveLength(3);
  });

  it('reports nothing lost from a table it read whole', () => {
    const store = browser({
      ...olderGame,
      [SEATS_KEY]: { turnIndex: 0, players: [seatOn('p1', WIN_LOKA), seatOn('p2', 23)] },
    });

    expect(readSeats(store).dropped).toBe(0);
    expect(readSeats(store).seats.players).toHaveLength(2);
  });

  it('seats nobody who was never there', () => {
    // A first visit is an absence, not a loss: there is no count to give.
    expect(readSeats(browser()).dropped).toBe(0);
    expect(readSeats(browser()).seats.players).toHaveLength(1);
    expect(readSeats(undefined).dropped).toBe(0);
  });

  it('counts what it lost even when nothing at all survived', () => {
    const store = browser({ ...olderGame, [SEATS_KEY]: { turnIndex: 0, players: unreadable } });

    const back = readSeats(store);

    expect(back.dropped).toBe(unreadable.length);
    expect(back.seats.players[0]?.state.loka).toBe(12);
  });

  it('will not seat more than a table holds', () => {
    const players = Array.from({ length: MAX_SEATS + 2 }, (_, at) => seatOn(`p${at + 1}`, at + 1));
    const store = browser({ ...olderGame, [SEATS_KEY]: { turnIndex: 0, players } });

    const back = readSeats(store);

    expect(back.seats.players).toHaveLength(MAX_SEATS);
    expect(back.dropped).toBe(2);
  });
});
