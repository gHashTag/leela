/**
 * A table that is there, and a chat told there is none.
 *
 * `DatabaseRoomStore.get` answered `null` to *no table in this chat* and to
 * *there is a table and the engine will not take it* alike. The log line beside
 * that choice says what it cost: *without this line nobody ever finds out why
 * their game vanished* — and it goes to a server log, which nobody at the table
 * can read.
 *
 * Two commands act on the difference and both acted wrongly:
 *
 * - `/end` replied *there is no table here* and left the row exactly where it
 *   was, so the chat had no way to clear it;
 * - `/new` carries a guard that refuses to replace a game in progress, and the
 *   guard asks whether a room came back. None did. So the next `/new` wrote a
 *   fresh table over every seat at the old one, silently.
 *
 * The rule these assert is not "a plan of 900 is refused". It is that **a row
 * that exists is never reported as an absence**: for every way a stored table
 * can fail to assemble, the store says a table is there, and the only thing
 * that removes it is a command somebody typed on purpose.
 */

import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import type { SessionPlayerRow, SessionRow } from '@leela/db';
import { join, openRoom, start, type Room } from '../src/commands';
import {
  DatabaseRoomStore,
  roomToRows,
  type RoomQueries,
  type StoredSeat,
  type StoredSession,
} from '../src/persistence';

const SEED = 4242;

function seatedRoom(): Room {
  let room = openRoom('chat-7', { id: 'u1', name: 'Ada' }, SEED, { language: 'en' }).room as Room;
  room = join(room, { id: 'u2', name: 'Grace' }).room as Room;
  room = join(room, { id: 'u3', name: 'Klara' }).room as Room;
  return start(room, 'u1').room as Room;
}

class FakeQueries implements RoomQueries {
  sessions = new Map<string, StoredSession>();
  seats = new Map<string, StoredSeat[]>();

  async loadSession(chatId: string): Promise<SessionRow | null> {
    const row = this.sessions.get(chatId);
    if (!row) return null;
    return { ...row, created_at: null, updated_at: null } as unknown as SessionRow;
  }

  async loadSeats(chatId: string): Promise<SessionPlayerRow[]> {
    return (this.seats.get(chatId) ?? []).map((row, i) => ({
      ...row,
      id: i + 1,
    })) as unknown as SessionPlayerRow[];
  }

  async save(session: StoredSession, seats: StoredSeat[]): Promise<void> {
    this.sessions.set(session.id, session);
    this.seats.set(session.id, seats);
  }

  async remove(chatId: string): Promise<void> {
    this.sessions.delete(chatId);
    this.seats.delete(chatId);
  }
}

/** A stored table, with one thing about it made impossible. */
function stored(
  damage: (rows: { session: StoredSession; seats: StoredSeat[] }) => void = () => undefined,
) {
  const queries = new FakeQueries();
  const rows = roomToRows(seatedRoom());
  damage(rows);
  queries.sessions.set(rows.session.id, rows.session);
  queries.seats.set(rows.session.id, rows.seats);

  return {
    queries,
    store: new DatabaseRoomStore(queries, () => undefined),
    chatId: rows.session.id,
  };
}

/** Every way a row can fail to become a game, one per shape. */
const damages: Array<[string, (rows: { session: StoredSession; seats: StoredSeat[] }) => void]> = [
  ['a plan off the board', (rows) => void (rows.seats[1]!.plan = 900)],
  ['plan zero', (rows) => void (rows.seats[1]!.plan = 0)],
  ['half a square', (rows) => void (rows.seats[1]!.plan = 41.5)],
  ['a previous plan past the end', (rows) => void (rows.seats[0]!.previous_plan = TOTAL_PLANS + 1)],
  [
    'finished somewhere other than the win square',
    (rows) => {
      rows.seats[2]!.plan = 41;
      rows.seats[2]!.is_finished = true;
    },
  ],
  ['a run of three sixes', (rows) => void (rows.seats[0]!.consecutive_sixes = 3)],
  ['a turn pointing past the table', (rows) => void (rows.session.turn_index = 9)],
  ['a turn before the first seat', (rows) => void (rows.session.turn_index = -1)],
  ['a negative roll count', (rows) => void (rows.session.roll_count = -5)],
  ['a variant nobody defines', (rows) => void (rows.session.ruleset = 'housebound')],
  ['two players in one seat', (rows) => void (rows.seats[1]!.seat = rows.seats[0]!.seat)],
  ['a seat with no player', (rows) => void (rows.seats[1]!.user_id = '')],
  ['no seats at all', (rows) => void (rows.seats.length = 0)],
];

describe('a stored table the engine will not take', () => {
  it('is never reported as an absence', async () => {
    const mistaken: string[] = [];

    for (const [name, damage] of damages) {
      const { store, chatId } = stored(damage);
      const read = await store.read(chatId);

      if (read.room !== null || !read.unreadable) {
        mistaken.push(
          `${name}: room ${read.room === null ? 'null' : 'assembled'}, ` +
            `unreadable ${String(read.unreadable)}`,
        );
      }
    }

    expect(mistaken).toEqual([]);
  });

  it('is still there after being read, however often it is read', async () => {
    // Reading is not clearing. The row survives every command that only looks
    // at it, so the one that removes it is the one somebody typed.
    const { store, queries, chatId } = stored(damages[0]![1]);

    await store.read(chatId);
    await store.get(chatId);
    await store.read(chatId);

    expect(queries.sessions.has(chatId)).toBe(true);
    expect(queries.seats.get(chatId)).toHaveLength(3);
  });

  it('is removed when a chat asks for it to be', async () => {
    // The way out, and the only one: a row nobody can read belongs to nobody,
    // and a chat that can neither continue nor start again is stuck.
    const { store, queries, chatId } = stored(damages[0]![1]);

    await store.delete(chatId);

    expect(queries.sessions.has(chatId)).toBe(false);
    expect(await store.read(chatId)).toEqual({ room: null, unreadable: false });
  });

  it('calls a chat with no row an absence, not a table', async () => {
    // The other half. Saying "there is a table I cannot read" to a chat that
    // has never had one would send it to /end to clear nothing.
    const { store } = stored();

    expect(await store.read('a-chat-nobody-has-played-in')).toEqual({
      room: null,
      unreadable: false,
    });
  });

  it('assembles a table that is merely finished, or merely waiting', async () => {
    // Guards the list above against a check that refuses everything: a game
    // whose players are all on the win square is a table, and so is one where
    // nobody has entered yet — both of which carry `is_finished`.
    const { store, chatId } = stored((rows) => {
      for (const seat of rows.seats) {
        seat.plan = WIN_LOKA;
        seat.is_finished = true;
      }
    });

    const read = await store.read(chatId);

    expect(read.unreadable).toBe(false);
    expect(read.room?.session.players).toHaveLength(3);
  });

  it('reads back a table nobody has damaged', async () => {
    const { store, chatId } = stored();
    const read = await store.read(chatId);

    expect(read).toEqual({ room: expect.anything(), unreadable: false });
    expect(read.room?.session.players.map((player) => player.name)).toEqual([
      'Ada',
      'Grace',
      'Klara',
    ]);
  });

  it('says why it refused the row without exporting the chat identifier', async () => {
    // The log is not the player's answer, and it is still the only place the
    // reason exists. A refusal that does not name the chat is one nobody can
    // find twice.
    const said: string[] = [];
    const queries = new FakeQueries();
    const rows = roomToRows(seatedRoom());
    rows.seats[1]!.plan = 900;
    queries.sessions.set(rows.session.id, rows.session);
    queries.seats.set(rows.session.id, rows.seats);

    await new DatabaseRoomStore(queries, (line) => said.push(line)).read(rows.session.id);

    expect(said).toHaveLength(1);
    expect(said[0]).not.toContain(rows.session.id);
    expect(said[0]).toContain('900');
  });
});
