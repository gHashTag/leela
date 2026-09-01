import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  ONLINE,
  advance,
  createSession,
  isSessionOver,
  seededRoller,
  submitReport,
} from '@leela/engine';
import { StoredRowsError, seatUpdate, sessionFromRows, sessionUpdate } from '../src';

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

/**
 * A database is as writable by hand as `localStorage`.
 *
 * `sessionFromRows` cast every column into engine state and handed the result
 * over. A `ruleset` no longer known became `undefined` typed as a `RuleSet`,
 * and the chat that row belonged to then threw on `rules.reports` for every
 * command anyone sent — forever, three files from the value that was wrong. A
 * stale `turn_index` did the same through `currentPlayer`.
 *
 * The rule is the one the mini app's loader uses, for the same reason: a saved
 * game must be one the engine could have produced. This one is read by
 * everyone at the table rather than by one player.
 */
describe('rows that are not a game', () => {
  /** A readable table, to break one field at a time. */
  function table() {
    return {
      session: {
        id: 's1',
        turn_index: 0,
        roll_count: 4,
        dice_seed: 7,
        is_open: false,
        ruleset: 'classic',
        language: 'en',
      },
      seats: seatRows(),
    };
  }

  it('reads a good one', () => {
    const { session, seats } = table();
    expect(sessionFromRows(session as never, seats).players).toHaveLength(2);
  });

  it('refuses a variant that no longer exists, rather than guessing', () => {
    const { session, seats } = table();
    expect(() => sessionFromRows({ ...session, ruleset: 'neuroleela-v2' } as never, seats)).toThrow(
      StoredRowsError,
    );
    // Not silently classic: that would change the rules mid-game.
    expect(() => sessionFromRows({ ...session, ruleset: 'toString' } as never, seats)).toThrow(
      /toString/,
    );
  });

  it('refuses a turn that points at nobody', () => {
    const { session, seats } = table();
    for (const turn_index of [2, 9, -1, 1.5, null]) {
      expect(() => sessionFromRows({ ...session, turn_index } as never, seats), String(turn_index))
        .toThrow(StoredRowsError);
    }
  });

  it('refuses a seat the engine could not have written', () => {
    // One field at a time, each a value the engine never produces.
    const broken: Array<[string, unknown]> = [
      ['plan', 0],
      ['plan', 73],
      ['plan', 41.5],
      ['plan', null],
      ['previous_plan', -1],
      ['position_before_three_sixes', 999],
      ['consecutive_sixes', 3],
      ['consecutive_sixes', -1],
      ['is_finished', 'yes'],
      ['report_submitted', null],
      ['user_id', ''],
      ['seat', 6],
      ['seat', -1],
    ];

    for (const [field, value] of broken) {
      const { session, seats } = table();
      const bad = seats.map((seat, at) => (at === 0 ? { ...(seat as object), [field]: value } : seat));
      expect(() => sessionFromRows(session as never, bad as never), `${field}=${String(value)}`)
        .toThrow(StoredRowsError);
    }
  });

  it('refuses a seat finished anywhere but the win square', () => {
    // The engine only ever sets the flag on 68. "Finished on plan 41" is not a
    // game, and the app would show a player waiting to enter while a throw
    // moved them from 41.
    const { session, seats } = table();
    const bad = seats.map((seat) =>
      (seat as { seat: number }).seat === 1 ? { ...(seat as object), plan: 41 } : seat,
    );
    expect(() => sessionFromRows(session as never, bad as never)).toThrow(/win square/);
  });

  it('refuses two players in one seat', () => {
    const { session, seats } = table();
    const bad = seats.map((seat) => ({ ...(seat as object), seat: 0 }));
    expect(() => sessionFromRows(session as never, bad as never)).toThrow(/seat 0/);
  });

  it('refuses more seats than the table has', () => {
    const { session } = table();
    const many = Array.from({ length: 7 }, (_, at) => ({
      ...(seatRows()[1] as object),
      user_id: `p${at}`,
      seat: at,
    }));
    expect(() => sessionFromRows(session as never, many as never)).toThrow(StoredRowsError);
  });

  it('names the seat it could not read, so the row can be found', () => {
    const { session, seats } = table();
    const bad = seats.map((seat) =>
      (seat as { user_id: string }).user_id === 'b' ? { ...(seat as object), plan: 900 } : seat,
    );
    // Seat 1 is 'b' once sorted. Twelve broken rows must not read as twelve
    // identical lines.
    expect(() => sessionFromRows(session as never, bad as never)).toThrow(/seat 1/);
    expect(() => sessionFromRows(session as never, bad as never)).toThrow(/\bb\b/);
  });
});

describe('everything a real game writes is readable again', () => {
  // The other half of the rule. A check that only rejects is a check that can
  // be satisfied by rejecting everything; this is what says it does not.
  it('round-trips every state a played-out table reaches', () => {
    for (let game = 0; game < 12; game += 1) {
      const die = seededRoller(game * 5 + 1);
      let session = createSession('s1', [{ id: 'a', name: 'Ay' }, { id: 'b', name: 'Bee' }], CLASSIC);

      for (let round = 0; round < 60; round += 1) {
        const rows = seats(session);
        const back = sessionFromRows(sessionRow(session), rows as never);

        expect(back.turnIndex).toBe(session.turnIndex);
        expect(back.players.map((p) => p.id)).toEqual(session.players.map((p) => p.id));
        expect(back.players.map((p) => p.state)).toEqual(session.players.map((p) => p.state));

        if (isSessionOver(session)) break;
        const holder = session.players[session.turnIndex];
        if (!holder.reportSubmitted) session = submitReport(session, holder.id);
        session = advance(session, die(), NOW + round * 86_400_000).session;
      }
    }
  });

  /**
   * The rows the bot would store, through the real writer.
   *
   * `seatUpdate` rather than a hand-built row: a copy here would be a second
   * idea of what a seat is, and this test exists because the first one drifted
   * from the engine. Writing the columns out by hand also lost `direction`,
   * which is the kind of thing this is supposed to catch.
   */
  function seats(session: ReturnType<typeof createSession>) {
    return session.players.map((player, at) => ({
      id: at,
      session_id: session.id,
      user_id: player.id,
      seat: at,
      name: player.name ?? null,
      ...seatUpdate(player),
    }));
  }

  function sessionRow(session: ReturnType<typeof createSession>) {
    return {
      id: session.id,
      turn_index: session.turnIndex,
      roll_count: session.rollCount,
      dice_seed: 1,
      is_open: false,
      ruleset: session.rules.id,
      language: 'en',
    } as never;
  }
});
