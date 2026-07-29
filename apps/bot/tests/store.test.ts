import { describe, expect, it } from 'vitest';
import { openRoom, type Room } from '../src/commands';
import { MemoryRoomStore, seedFor } from '../src/store';

describe('MemoryRoomStore', () => {
  it('returns null for a chat with no table', async () => {
    expect(await new MemoryRoomStore().get('nobody')).toBeNull();
  });

  it('round-trips a room', async () => {
    const store = new MemoryRoomStore();
    const room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 1).room as Room;

    await store.save(room);
    expect(await store.get('chat-1')).toEqual(room);
  });

  it('replaces a room rather than accumulating rooms', async () => {
    const store = new MemoryRoomStore();
    await store.save(openRoom('chat-1', { id: 'u1', name: 'A' }, 1).room as Room);
    await store.save(openRoom('chat-1', { id: 'u1', name: 'A' }, 2).room as Room);

    expect(store.size).toBe(1);
    expect((await store.get('chat-1'))?.seed).toBe(2);
  });

  it('forgets a deleted room', async () => {
    const store = new MemoryRoomStore();
    await store.save(openRoom('chat-1', { id: 'u1', name: 'A' }, 1).room as Room);
    await store.delete('chat-1');

    expect(await store.get('chat-1')).toBeNull();
    expect(store.size).toBe(0);
  });

  it('keeps rooms in different chats apart', async () => {
    const store = new MemoryRoomStore();
    await store.save(openRoom('chat-1', { id: 'u1', name: 'A' }, 1).room as Room);
    await store.save(openRoom('chat-2', { id: 'u2', name: 'B' }, 2).room as Room);

    expect((await store.get('chat-1'))?.seed).toBe(1);
    expect((await store.get('chat-2'))?.seed).toBe(2);
  });
});

describe('seedFor', () => {
  it('is stable for the same chat and salt', () => {
    expect(seedFor('chat-1', 5)).toBe(seedFor('chat-1', 5));
  });

  it('differs between chats opened at the same moment', () => {
    expect(seedFor('chat-1', 5)).not.toBe(seedFor('chat-2', 5));
  });

  it('differs between two tables in the same chat', () => {
    expect(seedFor('chat-1', 5)).not.toBe(seedFor('chat-1', 6));
  });

  it('is an unsigned 32-bit integer, which is what the roller wants', () => {
    for (const salt of [0, 1, 1_700_000_000_000, -5]) {
      const seed = seedFor('chat', salt);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('spreads across the range rather than clustering', () => {
    const seeds = new Set(Array.from({ length: 500 }, (_, i) => seedFor(`chat-${i}`, 1)));
    expect(seeds.size).toBe(500);
  });
});
