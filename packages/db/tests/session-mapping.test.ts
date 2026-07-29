import { describe, expect, it } from 'vitest';
import { CLASSIC, ONLINE, advance, createSession, submitReport } from '@leela/engine';
import { seatUpdate, sessionFromRows, sessionUpdate } from '../src';

const NOW = 1_700_000_000_000;

/** Seat rows as Postgres would hand them back — deliberately out of order. */
function seatRows() {
  return [
    {
      id: 2,
      session_id: 's1',
      user_id: 'b',
      seat: 1,
      name: 'Bee',
      plan: 68,
      previous_plan: 0,
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: true,
      last_roll_at: null,
      report_submitted: true,
    },
    {
      id: 1,
      session_id: 's1',
      user_id: 'a',
      seat: 0,
      name: 'Ay',
      plan: 23,
      previous_plan: 10,
      consecutive_sixes: 1,
      position_before_three_sixes: 10,
      is_finished: false,
      last_roll_at: new Date(NOW),
      report_submitted: false,
    },
  ] as never[];
}

/** Only the columns `sessionFromRows` reads; `ruleset` is nullable in old rows. */
const sessionRow: {
  id: string;
  ruleset: string | null;
  turn_index: number;
  roll_count: number;
} = {
  id: 's1',
  ruleset: 'classic',
  turn_index: 0,
  roll_count: 4,
};

describe('sessionFromRows', () => {
  it('orders seats by seat number, not by query order', () => {
    const session = sessionFromRows(sessionRow, seatRows());
    expect(session.players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('carries the state, the clock and the report flag onto each seat', () => {
    const [a, b] = sessionFromRows(sessionRow, seatRows()).players;

    expect(a.state).toEqual({
      loka: 23,
      previous_loka: 10,
      direction: '',
      consecutive_sixes: 1,
      position_before_three_sixes: 10,
      is_finished: false,
    });
    expect(a.lastRollAt).toBe(NOW);
    expect(a.reportSubmitted).toBe(false);
    expect(a.name).toBe('Ay');

    expect(b.lastRollAt).toBeNull();
  });

  it('resolves the stored variant', () => {
    expect(sessionFromRows(sessionRow, seatRows()).rules).toBe(CLASSIC);
    expect(sessionFromRows({ ...sessionRow, ruleset: 'online' }, seatRows()).rules).toBe(ONLINE);
  });

  it('defaults a row that predates the column', () => {
    expect(sessionFromRows({ ...sessionRow, ruleset: null }, seatRows()).rules).toBe(CLASSIC);
  });
});

describe('round trip', () => {
  it('plays a group game and reads back exactly what it wrote', () => {
    let session = createSession('s1', [{ id: 'a' }, { id: 'b' }], CLASSIC);

    // a enters, reflects, moves; b enters.
    session = advance(session, 6, NOW).session;
    session = submitReport(session, 'a');
    session = advance(session, 3, NOW).session;
    session = advance(session, 6, NOW).session;

    // Write it out the way a repository would, then read it straight back.
    const rows = session.players.map((player, seat) => ({
      id: seat + 1,
      session_id: session.id,
      user_id: player.id,
      seat,
      name: player.name ?? null,
      ...seatUpdate(player),
    })) as never[];

    const stored = { id: session.id, ...sessionUpdate(session) };
    const restored = sessionFromRows(stored as never, rows);

    expect(restored.turnIndex).toBe(session.turnIndex);
    expect(restored.rollCount).toBe(session.rollCount);
    expect(restored.rules).toBe(session.rules);
    expect(restored.players).toEqual(session.players);
  });

  it('keeps playing from a restored session', () => {
    let session = createSession('s1', [{ id: 'a' }], CLASSIC);
    session = submitReport(advance(session, 6, NOW).session, 'a');

    const rows = session.players.map((player, seat) => ({
      id: seat + 1,
      session_id: session.id,
      user_id: player.id,
      seat,
      name: null,
      ...seatUpdate(player),
    })) as never[];

    const restored = sessionFromRows({ id: 's1', ...sessionUpdate(session) } as never, rows);
    const next = advance(restored, 4, NOW);

    // 6 + 4 = 10, which is an arrow to 23.
    expect(next.session.players[0].state.loka).toBe(23);
    expect(next.owesReport).toBe(true);
  });
});

describe('seatUpdate', () => {
  it('writes null rather than an epoch for a player who never rolled', () => {
    const session = createSession('s', [{ id: 'a' }], CLASSIC);
    expect(seatUpdate(session.players[0]).last_roll_at).toBeNull();
  });

  it('writes a Date for a player who has rolled', () => {
    const session = advance(createSession('s', [{ id: 'a' }], CLASSIC), 6, NOW).session;
    const update = seatUpdate(session.players[0]);
    expect(update.last_roll_at).toBeInstanceOf(Date);
    expect((update.last_roll_at as Date).getTime()).toBe(NOW);
  });
});
