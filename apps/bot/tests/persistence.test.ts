import { describe, expect, it } from 'vitest';
import type { SessionPlayerRow, SessionRow } from '@leela/db';
import { join, openRoom, report, roll, start, type Room } from '../src/commands';
import {
  DatabaseRoomStore,
  roomFromRows,
  roomToRows,
  type RoomQueries,
  type StoredSeat,
  type StoredSession,
} from '../src/persistence';

const NOW = 1_700_000_000_000;
const SEED = 4242;

/** A table part-way through a game, so the round trip has something to carry. */
function playedRoom(): Room {
  let room = openRoom('chat-7', { id: 'u1', name: 'Ada' }, SEED, { language: 'ru' })
    .room as Room;
  room = join(room, { id: 'u2', name: 'Grace' }).room as Room;
  room = start(room, 'u1').room as Room;

  for (let i = 0; i < 12; i++) {
    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;
    if (result.replies.some((r) => r.text.includes('/report'))) {
      room = report(room, holder.id, 'noted').room as Room;
    }
  }
  return room;
}

/**
 * A fake database: keeps the rows it was handed, and hands them back with the
 * surrogate keys and seat order a real query would produce.
 */
class FakeQueries implements RoomQueries {
  sessions = new Map<string, StoredSession>();
  seats = new Map<string, StoredSeat[]>();
  saves = 0;

  async loadSession(chatId: string): Promise<SessionRow | null> {
    const row = this.sessions.get(chatId);
    if (!row) return null;
    return { ...row, created_at: null, updated_at: null } as unknown as SessionRow;
  }

  async loadSeats(chatId: string): Promise<SessionPlayerRow[]> {
    const rows = this.seats.get(chatId) ?? [];
    // Deliberately reversed: seat order must come from the column, not the query.
    return [...rows]
      .reverse()
      .map((row, i) => ({ ...row, id: i + 1 })) as unknown as SessionPlayerRow[];
  }

  async save(session: StoredSession, seats: StoredSeat[]): Promise<void> {
    this.saves++;
    this.sessions.set(session.id, session);
    this.seats.set(session.id, seats);
  }

  async remove(chatId: string): Promise<void> {
    this.sessions.delete(chatId);
    this.seats.delete(chatId);
  }
}

describe('roomToRows', () => {
  it('names the host as seat zero', () => {
    const { session } = roomToRows(playedRoom());
    expect(session.host_id).toBe('u1');
  });

  it('stores the seed and the roll count, which is what makes a game replayable', () => {
    const room = playedRoom();
    const { session } = roomToRows(room);
    expect(session.dice_seed).toBe(SEED);
    expect(session.roll_count).toBe(room.rollsTaken);
  });

  it('records a started table as closed', () => {
    expect(roomToRows(playedRoom()).session.is_open).toBe(false);

    const fresh = openRoom('c', { id: 'u1', name: 'A' }, 1).room as Room;
    expect(roomToRows(fresh).session.is_open).toBe(true);
  });

  it('numbers the seats in turn order', () => {
    const { seats } = roomToRows(playedRoom());
    expect(seats.map((s) => s.seat)).toEqual([0, 1]);
    expect(seats.map((s) => s.user_id)).toEqual(['u1', 'u2']);
  });

  it('carries each player name onto its seat', () => {
    const { seats } = roomToRows(playedRoom());
    expect(seats.map((s) => s.name)).toEqual(['Ada', 'Grace']);
  });
});

describe('round trip', () => {
  it('reloads a game exactly as it was', () => {
    const room = playedRoom();
    const { session, seats } = roomToRows(room);

    const restored = roomFromRows(
      { ...session, created_at: null, updated_at: null } as unknown as SessionRow,
      seats.map((s, i) => ({ ...s, id: i + 1 })) as unknown as SessionPlayerRow[],
    );

    expect(restored).toEqual(room);
  });

  it('keeps the language, so a restart does not drop everyone into English', () => {
    const room = playedRoom();
    const { session, seats } = roomToRows(room);
    expect(session.language).toBe('ru');

    const restored = roomFromRows(session as never, seats as never);
    expect(restored.language).toBe('ru');
  });

  it('keeps the turn with whoever held it', () => {
    const room = playedRoom();
    const before = room.session.players[room.session.turnIndex].id;
    const { session, seats } = roomToRows(room);

    const restored = roomFromRows(session as never, seats as never);
    expect(restored.session.players[restored.session.turnIndex].id).toBe(before);
  });

  it('keeps an outstanding report outstanding', () => {
    let room = playedRoom();
    // Force someone to owe a report, then reload and check they still do.
    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;

    const owing = room.session.players.filter((p) => !p.reportSubmitted).map((p) => p.id);
    const { session, seats } = roomToRows(room);
    const restored = roomFromRows(session as never, seats as never);

    expect(restored.session.players.filter((p) => !p.reportSubmitted).map((p) => p.id)).toEqual(
      owing,
    );
  });

  it('defaults a row written before dice_seed existed', () => {
    const { session, seats } = roomToRows(playedRoom());
    const restored = roomFromRows({ ...session, dice_seed: null } as never, seats as never);
    expect(restored.seed).toBe(0);
  });

  it('falls back to English for a language the dataset does not carry', () => {
    const { session, seats } = roomToRows(playedRoom());
    const restored = roomFromRows({ ...session, language: 'kl' } as never, seats as never);
    expect(restored.language).toBe('en');
  });
});

describe('DatabaseRoomStore', () => {
  it('returns null for a chat with no table', async () => {
    expect(await new DatabaseRoomStore(new FakeQueries()).get('nobody')).toBeNull();
  });

  it('saves and reloads a room', async () => {
    const queries = new FakeQueries();
    const store = new DatabaseRoomStore(queries);
    const room = playedRoom();

    await store.save(room);
    expect(await store.get('chat-7')).toEqual(room);
  });

  it('does not trust the order seats come back in', async () => {
    // The fake deliberately reverses them.
    const store = new DatabaseRoomStore(new FakeQueries());
    const room = playedRoom();
    await store.save(room);

    const restored = await store.get('chat-7');
    expect(restored?.session.players.map((p) => p.id)).toEqual(['u1', 'u2']);
  });

  it('treats a session with no seats as absent rather than crashing the chat', async () => {
    const queries = new FakeQueries();
    const room = playedRoom();
    await new DatabaseRoomStore(queries).save(room);
    queries.seats.set('chat-7', []);

    expect(await new DatabaseRoomStore(queries).get('chat-7')).toBeNull();
  });

  it('forgets a deleted room', async () => {
    const queries = new FakeQueries();
    const store = new DatabaseRoomStore(queries);
    await store.save(playedRoom());
    await store.delete('chat-7');

    expect(await store.get('chat-7')).toBeNull();
  });

  it('writes the whole room in one call, so a roll cannot half-save', async () => {
    const queries = new FakeQueries();
    await new DatabaseRoomStore(queries).save(playedRoom());
    expect(queries.saves).toBe(1);
  });

  it('survives a restart mid-game and keeps playing from where it stopped', async () => {
    const queries = new FakeQueries();
    const room = playedRoom();
    await new DatabaseRoomStore(queries).save(room);

    // A brand new process, holding nothing.
    const restored = (await new DatabaseRoomStore(queries).get('chat-7')) as Room;
    const holder = restored.session.players[restored.session.turnIndex];

    const before = holder.state.loka;
    const result = roll(restored, holder.id, NOW);
    expect(result.replies[0].text).not.toMatch(/not started/i);

    // Either they moved, were asked for a report, or the throw was refused —
    // all valid, none of them "the game forgot where it was".
    const after = (result.room as Room).session.players.find((p) => p.id === holder.id);
    expect(after).toBeDefined();
    expect(typeof before).toBe('number');
  });
});

describe('a row the engine cannot be handed', () => {
  /**
   * One bad row used to break a chat permanently.
   *
   * `sessionFromRows` cast each column into engine state, so a `ruleset` no
   * longer known became `undefined` typed as a `RuleSet` and every command
   * sent to that chat then threw on `rules.reports`. The player saw silence,
   * which is the failure this bot has already been through once.
   *
   * A table that cannot be read is treated as no table: `/new` opens another,
   * and the reason is written down for whoever has to look.
   */
  function queriesReturning(session: unknown, seats: unknown[]): RoomQueries {
    return {
      loadSession: async () => session as never,
      loadSeats: async () => seats as never,
      save: async () => undefined,
      remove: async () => undefined,
    };
  }

  const goodSession = {
    id: 'c1',
    turn_index: 0,
    roll_count: 0,
    dice_seed: 3,
    is_open: false,
    ruleset: 'classic',
    language: 'en',
  };

  const goodSeat = {
    id: 1,
    session_id: 'c1',
    user_id: 'a',
    seat: 0,
    name: 'Ay',
    plan: 68,
    previous_plan: 0,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: true,
    last_roll_at: null,
    report_submitted: true,
  };

  it('reads a good table', async () => {
    const store = new DatabaseRoomStore(queriesReturning(goodSession, [goodSeat]), () => undefined);
    expect(await store.get('c1')).not.toBeNull();
  });

  it('is no table rather than a throw, whatever is wrong with it', async () => {
    // Not a list of corruptions: each of these is a different column, and the
    // answer has to be the same for all of them, because a chat that throws on
    // every update cannot be recovered by anyone using it.
    const corruptions: Array<[string, unknown, unknown]> = [
      ['an unknown variant', { ...goodSession, ruleset: 'neuroleela-v2' }, [goodSeat]],
      ['a turn pointing at nobody', { ...goodSession, turn_index: 4 }, [goodSeat]],
      ['a plan off the board', goodSession, [{ ...goodSeat, plan: 900 }]],
      ['a run of three sixes', goodSession, [{ ...goodSeat, consecutive_sixes: 3 }]],
      ['finished off the win square', goodSession, [{ ...goodSeat, plan: 41 }]],
      ['a seat with no user', goodSession, [{ ...goodSeat, user_id: '' }]],
      ['two players in one seat', goodSession, [goodSeat, { ...goodSeat, user_id: 'b' }]],
    ];

    for (const [what, session, seats] of corruptions) {
      const store = new DatabaseRoomStore(queriesReturning(session, seats as unknown[]), () => undefined);
      await expect(store.get('c1'), what).resolves.toBeNull();
    }
  });

  it('says why, so the row can be found', async () => {
    const said: string[] = [];
    const store = new DatabaseRoomStore(
      queriesReturning({ ...goodSession, ruleset: 'gone' }, [goodSeat]),
      (message) => said.push(message),
    );

    await store.get('c1');

    expect(said).toHaveLength(1);
    expect(said[0]).toContain('c1');
    expect(said[0]).toContain('gone');
  });

  it('still lets a failure that is not about the rows through', async () => {
    // A database that is down is not a corrupt table, and swallowing it would
    // turn an outage into "no table here" for everyone at once.
    const store = new DatabaseRoomStore(
      {
        loadSession: async () => {
          throw new Error('the database went away');
        },
        loadSeats: async () => [],
        save: async () => undefined,
        remove: async () => undefined,
      },
      () => undefined,
    );

    await expect(store.get('c1')).rejects.toThrow(/went away/);
  });
});

describe('every table held', () => {
  /** The fake, able to list what it holds — in insertion order, like SQL by updated_at. */
  class ListingQueries extends FakeQueries {
    async allSessions(): Promise<string[]> {
      return [...this.sessions.keys()];
    }
  }

  /** The same table under another chat, so the walk has more than one stop. */
  function elsewhere(room: Room): Room {
    return { ...room, chatId: 'chat-8', session: { ...room.session, id: 'chat-8' } };
  }

  it('walks every id the queries hand it and returns whole rooms', async () => {
    const queries = new ListingQueries();
    const store = new DatabaseRoomStore(queries);
    const played = playedRoom();
    await store.save(played);
    await store.save(elsewhere(played));

    const rooms = await store.allRooms();
    expect(rooms.map((room) => room.chatId)).toEqual(['chat-7', 'chat-8']);
    expect(rooms[0]).toEqual(played);
  });

  it('skips a row that will not assemble rather than stopping the walk', async () => {
    const said: string[] = [];
    const queries = new ListingQueries();
    const store = new DatabaseRoomStore(queries, (message) => said.push(message));
    const played = playedRoom();
    await store.save(played);
    await store.save(elsewhere(played));
    // A table with no seats: there is a row, and the engine will not take it.
    queries.seats.set('chat-7', []);

    const rooms = await store.allRooms();
    expect(rooms.map((room) => room.chatId)).toEqual(['chat-8']);
    // Logged through the same line every other refused row goes through.
    expect(said.some((line) => line.includes('chat-7'))).toBe(true);
  });

  it('enumerates nothing when the queries cannot list, rather than guessing', async () => {
    // `FakeQueries` has no `allSessions`, which is the convention for a
    // queries object that cannot answer — the walk visits nobody.
    const store = new DatabaseRoomStore(new FakeQueries());
    await store.save(playedRoom());
    expect(await store.allRooms()).toEqual([]);
  });
});
