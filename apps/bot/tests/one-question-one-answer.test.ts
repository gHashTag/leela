import { describe, expect, it } from 'vitest';
import { currentPlayer } from '@leela/engine';
import { SqliteRoomQueries, sqliteReportSink } from '../src/sqlite';
import { DatabaseRoomStore } from '../src/persistence';
import { MemoryReportSink, MemoryRoomStore, type ReportSink, type RoomStore } from '../src/store';
import { join, openRoom, report, roll, start, type Room } from '../src/commands';

/**
 * Two implementations of one question give one answer.
 *
 * The pass before found a defect exactly here and nowhere else it could have
 * been found: both stores documented `roomOf` as "the table you played last",
 * and only one of them did it — the database ordered by a timestamp that
 * `Date.now()` can repeat, so two tables touched in the same millisecond left
 * the answer to SQLite. Each store's own tests were happy. The disagreement was
 * only visible from a test that asked them both.
 *
 * So this file asks all of it twice: every question the bot puts to a store,
 * put to every store there is. A third implementation — a Postgres one, a
 * Redis one — has a suite waiting for it and cannot arrive with a subtly
 * different idea of what a room is.
 *
 * This pass found nothing. That is the result: three pairs, asked the same
 * questions, agreeing — and the agreement is now enforced rather than
 * incidental.
 */

const NOW = 1_700_000_000_000;
const SAME_MOMENT = new Date(NOW);

function roomStores(): Array<{ what: string; store: RoomStore }> {
  return [
    { what: 'in memory', store: new MemoryRoomStore() },
    {
      what: 'in sqlite',
      store: new DatabaseRoomStore(new SqliteRoomQueries({ path: ':memory:' })),
    },
  ];
}

function sinks(): Array<{ what: string; sink: ReportSink }> {
  return [
    { what: 'in memory', sink: new MemoryReportSink() },
    { what: 'in sqlite', sink: sqliteReportSink(new SqliteRoomQueries({ path: ':memory:' })) },
  ];
}

/** A table of three, started. */
function table(chatId = 'chat-1', seed = 4242): Room {
  let room = openRoom(chatId, { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  room = join(room, { id: 'u3', name: 'Cy' }).room as Room;
  return start(room, 'u1').room as Room;
}

/** A game with forty turns behind it, so every field has been moved. */
function played(): Room {
  let room = table();

  for (let turn = 0; turn < 40; turn += 1) {
    const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1000);
    if (thrown.room) room = thrown.room;

    for (const seat of room.session.players) {
      if (seat.reportSubmitted) continue;
      const filed = report(room, seat.id, `About ${seat.state.loka}.`, NOW + turn * 1000 + 1);
      if (filed.room) room = filed.room;
    }
  }

  return room;
}

describe('every store keeps the same room', () => {
  it('gives back what it was given, down to the turn holder', async () => {
    // Forty turns in, which is the only way to be sure every field has moved
    // off its default: a fresh table round-trips even through a store that
    // loses half of it.
    const room = played();

    for (const { what, store } of roomStores()) {
      await store.save(room);
      const back = await store.get('chat-1');

      expect(back, what).not.toBeNull();
      expect(back?.session, what).toEqual(room.session);
      expect(back?.names, what).toEqual(room.names);
      expect(back?.seed, what).toBe(room.seed);
      expect(back?.rollsTaken, what).toBe(room.rollsTaken);
      expect(back?.language, what).toBe(room.language);
      expect(back?.started, what).toBe(room.started);
    }
  });

  it('lets a table shrink without leaving a seat behind', async () => {
    // A player can leave, and a stale seat would keep taking turns.
    for (const { what, store } of roomStores()) {
      const room = table();
      await store.save(room);

      await store.save({
        ...room,
        session: { ...room.session, turnIndex: 0, players: room.session.players.slice(0, 2) },
        names: { u1: 'Ada', u2: 'Bo' },
      });

      const back = await store.get('chat-1');
      expect(back?.session.players.map((seat) => seat.id), what).toEqual(['u1', 'u2']);
      expect(Object.keys(back?.names ?? {}), what).toEqual(['u1', 'u2']);
    }
  });

  it('forgets a table it was told to forget, and everything about it', async () => {
    for (const { what, store } of roomStores()) {
      await store.save(table());
      await store.delete('chat-1');

      expect(await store.get('chat-1'), what).toBeNull();
      expect((await store.roomOf?.('u1')) ?? null, what).toBeNull();
    }
  });

  it('has nothing for a chat that never had a table', async () => {
    for (const { what, store } of roomStores()) {
      expect(await store.get('chat-nowhere'), what).toBeNull();
    }
  });

  it('opens a new table in a chat that had one before', async () => {
    for (const { what, store } of roomStores()) {
      await store.save(table());
      await store.delete('chat-1');
      await store.save(table('chat-1', 7));

      expect((await store.get('chat-1'))?.session.players, what).toHaveLength(3);
      expect((await store.get('chat-1'))?.seed, what).toBe(7);
    }
  });
});

describe('every sink keeps the same writing', () => {
  it('gives it back newest first, even written in one millisecond', async () => {
    // The tie that has bitten twice: `/path` once, and `roomOf` the pass before.
    // Two answers to "which came last" is one of them being wrong.
    for (const { what, sink } of sinks()) {
      await sink.record({ userId: 'u1', plan: 6, text: 'first', at: SAME_MOMENT });
      await sink.record({ userId: 'u1', plan: 9, text: 'second', at: SAME_MOMENT });
      await sink.record({ userId: 'u1', plan: 12, text: 'third', at: SAME_MOMENT });

      expect((await sink.history?.('u1'))?.map((entry) => entry.text), what).toEqual([
        'third',
        'second',
        'first',
      ]);
    }
  });

  it('holds one question per player, replaced when it changes', async () => {
    for (const { what, sink } of sinks()) {
      expect(await sink.intention?.('u1'), what).toBeNull();

      await sink.setIntention?.('u1', 'the first question');
      await sink.setIntention?.('u1', 'the second question');

      expect(await sink.intention?.('u1'), what).toBe('the second question');
      expect(await sink.intention?.('u2'), what).toBeNull();
    }
  });

  it('has an empty path for a stranger, rather than nothing at all', async () => {
    // The distinction the whole surface rests on: "you have written nothing"
    // and "this bot keeps nothing" are different sentences.
    for (const { what, sink } of sinks()) {
      expect(await sink.history?.('nobody'), what).toEqual([]);
    }
  });
});
