import { describe, expect, it } from 'vitest';
import { currentPlayer } from '@leela/engine';
import { SqliteRoomQueries } from '../src/sqlite';
import { DatabaseRoomStore } from '../src/persistence';
import { MemoryRoomStore, type RoomStore } from '../src/store';
import { join, openRoom, roll, start, type Room } from '../src/commands';

/**
 * Which of your tables did you mean.
 *
 * A room is keyed by the chat it lives in, which is right for every command
 * sent at the table. `/ask` is not one of those — the companion answers
 * privately, so the natural place to ask is a private chat, and there is no
 * table there. `roomOf` answers it, and what it answers is **the table you
 * played last**.
 *
 * Both stores said so in their own comments. Only one of them did it. The
 * in-memory store re-inserts on save, so its order is the order of play; the
 * database ordered by `updated_at`, and `Date.now()` has one millisecond to
 * spend on several saves — so two tables touched inside the same millisecond
 * left the answer to SQLite, which chose, and chose differently.
 *
 * The same tie this repository met in `/path`: two reports written in one
 * millisecond came back in whatever order the database felt like, and `id` was
 * added to break it. There is no second column to break this one, so the clock
 * stops repeating itself instead.
 *
 * The rule is not about milliseconds. It is: **two stores of one question give
 * one answer**, and the way to find out is to ask them both.
 */

const NOW = 1_700_000_000_000;

function table(chatId: string, seed: number): Room {
  let room = openRoom(chatId, { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  return start(room, 'u1').room as Room;
}

function stores(): Array<{ what: string; store: RoomStore }> {
  return [
    { what: 'in memory', store: new MemoryRoomStore() },
    {
      what: 'in sqlite',
      store: new DatabaseRoomStore(new SqliteRoomQueries({ path: ':memory:' })),
    },
  ];
}

describe('the table a player meant', () => {
  it('is the one they played last, in every store there is', async () => {
    // Saved back to back, which is what a bot handling two updates does. The
    // whole defect lived in the width of a millisecond.
    for (const { what, store } of stores()) {
      const second = table('chat-2', 7);
      const first = table('chat-1', 4242);

      await store.save(second);
      await store.save(first);

      const thrown = roll(second, currentPlayer(second.session).id, NOW);
      await store.save((thrown.room as Room) ?? second);

      expect((await store.roomOf?.('u1'))?.chatId, what).toBe('chat-2');
    }
  });

  it('changes when they play the other one', async () => {
    for (const { what, store } of stores()) {
      const one = table('chat-1', 4242);
      const two = table('chat-2', 7);

      await store.save(one);
      await store.save(two);
      expect((await store.roomOf?.('u1'))?.chatId, what).toBe('chat-2');

      const back = roll(one, currentPlayer(one.session).id, NOW);
      await store.save((back.room as Room) ?? one);
      expect((await store.roomOf?.('u1'))?.chatId, what).toBe('chat-1');
    }
  });

  it('is nobody’s table for somebody who sits at none', async () => {
    for (const { what, store } of stores()) {
      await store.save(table('chat-1', 4242));
      expect(await store.roomOf?.('a-stranger'), what).toBeNull();
    }
  });

  it('is the table they are at, not the table they opened', async () => {
    // A player who joined somebody else's table is seated at it. Ownership is
    // not the question; who is sitting there is.
    for (const { what, store } of stores()) {
      await store.save(table('chat-1', 4242));
      expect((await store.roomOf?.('u2'))?.chatId, what).toBe('chat-1');
    }
  });
});
