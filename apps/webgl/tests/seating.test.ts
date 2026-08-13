import { describe, expect, it } from 'vitest';
import { MAX_SEATS } from '@leela/engine';

import { DEITIES, deityForSeat, seatsOf } from '../src/deities';

/**
 * `createBoard` needs WebGL, so no test can hold the board itself — which is
 * how `setSeats` and `token` changed twice in two passes with nothing checking
 * them. What *can* be held is the part that decides what the board is asked to
 * draw, and it is also the part that can be silently wrong: two seats sharing a
 * colour is a table where nobody can tell whose token is whose, and an id that
 * does not match the one the session rotates is a token that never moves.
 */

const ids = (count: number) => Array.from({ length: count }, (_, at) => `p${at + 1}`);

describe('seating a table', () => {
  it('gives every seat at a full table its own deity', () => {
    const seats = seatsOf(ids(MAX_SEATS));
    expect(seats).toHaveLength(MAX_SEATS);
    expect(new Set(seats.map((seat) => seat.deity.id)).size).toBe(MAX_SEATS);
  });

  it('keeps the ids it was given, in order', () => {
    expect(seatsOf(ids(4)).map((seat) => seat.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  /** The board is the same board the next time it is opened. */
  it('seats the same table the same way twice', () => {
    expect(seatsOf(ids(3))).toEqual(seatsOf(ids(3)));
  });

  it('honours a choice and defaults only where there is none', () => {
    const seats = seatsOf(ids(3), [undefined, 'durga', undefined]);
    expect(seats[1]?.deity.latin).toBe('Durga');
    expect(seats[0]?.deity).toEqual(deityForSeat(0));
    expect(seats[2]?.deity).toEqual(deityForSeat(2));
  });

  /** A roster that changed between releases costs a preference, not a token. */
  it('falls back rather than leaving a seat with no deity', () => {
    const seats = seatsOf(ids(2), ['ganesha', '']);
    for (const seat of seats) {
      expect(seat.deity.id.length).toBeGreaterThan(0);
      expect(DEITIES).toContain(seat.deity);
    }
  });

  it('never runs out, however many seats it is asked for', () => {
    for (let at = 0; at < DEITIES.length * 3; at += 1) {
      expect(DEITIES).toContain(deityForSeat(at));
    }
    expect(deityForSeat(-1)).toBeDefined();
    expect(DEITIES).toContain(deityForSeat(-1));
  });

  it('seats nobody when asked for nobody', () => {
    expect(seatsOf([])).toEqual([]);
  });
});
