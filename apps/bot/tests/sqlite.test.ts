import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { join as seat, openRoom, report, roll, start, type Room } from '../src/commands';
import { DatabaseRoomStore } from '../src/persistence';
import { SqliteRoomQueries, sqliteReportSink } from '../src/sqlite';

const NOW = 1_700_000_000_000;
const dir = mkdtempSync(join(tmpdir(), 'leela-sqlite-'));
const open: SqliteRoomQueries[] = [];

afterAll(() => {
  for (const queries of open) queries.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A fresh database, on disk so it can be reopened. */
function database(name: string): SqliteRoomQueries {
  const queries = new SqliteRoomQueries({ path: join(dir, `${name}.db`), now: () => NOW });
  open.push(queries);
  return queries;
}

/** A table part-way through a game. */
function playedRoom(chatId = 'chat-1'): Room {
  let room = openRoom(chatId, { id: 'u1', name: 'Ada' }, 4242, { language: 'ru' }).room as Room;
  room = seat(room, { id: 'u2', name: 'Grace' }).room as Room;
  room = start(room, 'u1').room as Room;

  for (let i = 0; i < 10; i++) {
    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;
    if (result.replies.some((r) => r.text.includes('/report'))) {
      room = report(room, holder.id, 'noted').room as Room;
    }
  }
  return room;
}

describe('a game survives a restart', () => {
  // This is the whole reason the file exists: the bot announced on every start
  // that games in progress would be lost.

  it('reloads a played game exactly, from a process that never saw it', async () => {
    const path = join(dir, 'restart.db');
    const room = playedRoom();

    const first = new SqliteRoomQueries({ path, now: () => NOW });
    await new DatabaseRoomStore(first).save(room);
    first.close();

    // A brand new process, holding nothing.
    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    const restored = await new DatabaseRoomStore(second).get(room.chatId);

    expect(restored).toEqual(room);
  });

  it('keeps playing from where it stopped', async () => {
    const store = new DatabaseRoomStore(database('continue'));
    const room = playedRoom('chat-continue');
    await store.save(room);

    let restored = (await store.get('chat-continue')) as Room;
    const holder = restored.session.players[restored.session.turnIndex];

    // The gate survives the restart too, so clear it before expecting a roll.
    if (!holder.reportSubmitted) {
      restored = report(restored, holder.id, 'noted').room as Room;
    }

    const result = roll(restored, holder.id, NOW);
    expect(result.replies[0].text).not.toMatch(/not started|\/report/i);
    expect((result.room as Room).rollsTaken).toBe(room.rollsTaken + 1);
  });
});

describe('SqliteRoomQueries', () => {
  let queries: SqliteRoomQueries;
  let store: DatabaseRoomStore;

  beforeEach(() => {
    queries = database(`q-${Math.floor(performance.now() * 1000)}`);
    store = new DatabaseRoomStore(queries);
  });

  it('returns null for a chat it has never seen', async () => {
    expect(await store.get('nobody')).toBeNull();
  });

  it('round-trips every field, including the ones SQLite has no type for', async () => {
    const room = playedRoom('chat-fields');
    await store.save(room);
    const restored = (await store.get('chat-fields')) as Room;

    // Booleans are 1 and 0 in SQLite; dates are numbers. Both must read back
    // as themselves or the engine sees a different game.
    expect(restored.started).toBe(room.started);
    expect(restored.language).toBe('ru');
    expect(restored.seed).toBe(room.seed);
    for (const [index, player] of restored.session.players.entries()) {
      expect(typeof player.state.is_finished).toBe('boolean');
      expect(player.reportSubmitted).toBe(room.session.players[index].reportSubmitted);
      expect(player.lastRollAt).toBe(room.session.players[index].lastRollAt);
    }
  });

  it('replaces seats rather than accumulating them', async () => {
    const room = playedRoom('chat-seats');
    await store.save(room);
    await store.save(room);
    await store.save(room);

    expect((await queries.loadSeats('chat-seats'))).toHaveLength(2);
  });

  it('drops a seat that has left, so it cannot keep taking turns', async () => {
    const two = playedRoom('chat-left');
    await store.save(two);

    const one: Room = {
      ...two,
      session: { ...two.session, players: two.session.players.slice(0, 1), turnIndex: 0 },
    };
    await store.save(one);

    const restored = (await store.get('chat-left')) as Room;
    expect(restored.session.players.map((p) => p.id)).toEqual(['u1']);
  });

  it('orders seats by seat number, not by insertion', async () => {
    const room = playedRoom('chat-order');
    await store.save(room);
    const seats = await queries.loadSeats('chat-order');
    expect(seats.map((s) => s.seat)).toEqual([0, 1]);
    expect(seats.map((s) => s.user_id)).toEqual(['u1', 'u2']);
  });

  it('forgets a deleted room, and its seats with it', async () => {
    const room = playedRoom('chat-delete');
    await store.save(room);
    await store.delete('chat-delete');

    expect(await store.get('chat-delete')).toBeNull();
    expect(await queries.loadSeats('chat-delete')).toEqual([]);
  });

  it('keeps two chats apart', async () => {
    await store.save(playedRoom('chat-a'));
    await store.save(playedRoom('chat-b'));

    expect((await store.get('chat-a'))?.chatId).toBe('chat-a');
    expect((await store.get('chat-b'))?.chatId).toBe('chat-b');
  });

  it('writes a room whole or not at all', async () => {
    const room = playedRoom('chat-atomic');
    await store.save(room);

    // A seat that violates the unique index aborts the transaction, and the
    // session it belongs to must not be left rewritten around a missing seat.
    const before = await store.get('chat-atomic');
    const duplicated = { ...room, session: { ...room.session, rollCount: 999 } };
    const seats = duplicated.session.players.map((player, index) => ({
      session_id: 'chat-atomic',
      user_id: 'same-user',
      seat: index,
      name: null,
      plan: 1,
      previous_plan: 0,
      direction: '',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
      last_roll_at: null,
      report_submitted: true,
    }));

    await expect(
      queries.save(
        { id: 'chat-atomic', host_id: 'u1', ruleset: 'classic', turn_index: 0, roll_count: 999, dice_seed: 1, is_open: false, language: 'en' },
        seats,
      ),
    ).rejects.toThrow();

    expect((await store.get('chat-atomic'))?.rollsTaken).toBe(before?.rollsTaken);
  });
});

describe('reports', () => {
  it('keeps what a player wrote, newest first', async () => {
    const queries = database('reports');
    const sink = sqliteReportSink(queries);

    await sink.record({ userId: 'u1', plan: 5, text: 'first' });
    await sink.record({ userId: 'u1', plan: 9, text: 'second' });
    await sink.record({ userId: 'u2', plan: 3, text: 'someone else' });

    const mine = queries.reportsFor('u1');
    expect(mine.map((r) => r.text)).toEqual(['second', 'first']);
    expect(mine[0].plan).toBe(9);
    expect(mine[0].createdAt).toBeInstanceOf(Date);
  });

  it('keeps two reports on the same plan, because a player may return to it', async () => {
    const queries = database('reports-repeat');
    const sink = sqliteReportSink(queries);
    await sink.record({ userId: 'u1', plan: 5, text: 'first time' });
    await sink.record({ userId: 'u1', plan: 5, text: 'and again' });

    expect(queries.reportsFor('u1')).toHaveLength(2);
  });

  it('returns nothing for a player who has written nothing', () => {
    expect(database('reports-empty').reportsFor('nobody')).toEqual([]);
  });

  it('survives a restart, like the rooms', async () => {
    const path = join(dir, 'reports-restart.db');
    const first = new SqliteRoomQueries({ path, now: () => NOW });
    first.recordReport({ userId: 'u1', plan: 7, text: 'kept' });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    expect(second.reportsFor('u1').map((r) => r.text)).toEqual(['kept']);
  });
});

describe('the schema', () => {
  it('is safe to open twice, so a restart does not fail on CREATE TABLE', () => {
    const path = join(dir, 'twice.db');
    const first = new SqliteRoomQueries({ path });
    first.close();
    const second = new SqliteRoomQueries({ path });
    open.push(second);
    expect(second).toBeDefined();
  });
});
