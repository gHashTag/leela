import { describe, expect, it } from 'vitest';
import { openRoom, type Room } from '../src/commands';
import { DAY_MS } from '../src/stars';
import {
  MemoryNudgeStore,
  MemoryReportSink,
  MemoryRoomStore,
  discardReports,
  seedFor,
} from '../src/store';

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

describe('a daily word converted into play', () => {
  it('counts each accepted action once, only inside the latest word’s day', async () => {
    const nudges = new MemoryNudgeStore();
    const morning = Date.UTC(2026, 8, 2, 6);

    expect(await nudges.convert('u1', 'response', morning)).toBe(false);
    await nudges.record('u1', { at: morning, excerpt: 0 });
    expect(await nudges.convert('u1', 'response', morning - 1)).toBe(false);
    expect(await nudges.convert('u1', 'response', morning)).toBe(true);
    expect(await nudges.convert('u1', 'response', morning + 1)).toBe(false);
    expect(await nudges.convert('u1', 'roll', morning + DAY_MS - 1)).toBe(true);
    expect(await nudges.convert('u1', 'roll', morning + DAY_MS)).toBe(false);

    await nudges.record('u1', { at: morning + DAY_MS, excerpt: 1 });
    expect(await nudges.convert('u1', 'response', morning + DAY_MS)).toBe(true);

    await nudges.record('u2', { at: morning, excerpt: 0 });
    expect(await nudges.convert('u2', 'response', morning + DAY_MS)).toBe(false);
    expect(await nudges.convert('u2', 'roll', morning + DAY_MS)).toBe(false);
  });
});

describe('report sinks', () => {
  it('keeps what it is given, in the order it arrived', async () => {
    const sink = new MemoryReportSink();
    await sink.record({ userId: 'u1', plan: 5, text: 'first' });
    await sink.record({ userId: 'u1', plan: 9, text: 'second' });

    expect(sink.reports.map(({ userId, plan, text }) => ({ userId, plan, text }))).toEqual([
      { userId: 'u1', plan: 5, text: 'first' },
      { userId: 'u1', plan: 9, text: 'second' },
    ]);
    // Each carries when it was written, which is what orders a path.
    for (const report of sink.reports) expect(report.createdAt).toBeInstanceOf(Date);
  });

  it('keeps two reports on the same plan, because a player may return to it', async () => {
    const sink = new MemoryReportSink();
    await sink.record({ userId: 'u1', plan: 5, text: 'first time here' });
    await sink.record({ userId: 'u1', plan: 5, text: 'and again' });
    expect(sink.reports).toHaveLength(2);
  });

  it('discards without complaining, for running with no storage', async () => {
    await expect(
      discardReports.record({ userId: 'u1', plan: 1, text: 'gone' }),
    ).resolves.toBeUndefined();
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

describe('reading a path back', () => {
  it('returns what a player wrote, newest first', async () => {
    let clock = 1000;
    const sink = new MemoryReportSink(() => (clock += 1000));

    await sink.record({ userId: 'u1', plan: 5, text: 'first' });
    await sink.record({ userId: 'u1', plan: 9, text: 'second' });

    expect((await sink.history('u1')).map((r) => r.text)).toEqual(['second', 'first']);
  });

  it('returns only that player’s own writing', async () => {
    const sink = new MemoryReportSink();
    await sink.record({ userId: 'u1', plan: 5, text: 'mine' });
    await sink.record({ userId: 'u2', plan: 5, text: 'theirs' });

    expect((await sink.history('u1')).map((r) => r.text)).toEqual(['mine']);
  });

  it('returns nothing for someone who has written nothing', async () => {
    expect(await new MemoryReportSink().history('nobody')).toEqual([]);
  });

  it('stamps each report with when it was written', async () => {
    const sink = new MemoryReportSink(() => 1_700_000_000_000);
    await sink.record({ userId: 'u1', plan: 5, text: 'x' });
    expect((await sink.history('u1'))[0].createdAt).toEqual(new Date(1_700_000_000_000));
  });

  it('offers no history at all when reports are discarded', () => {
    // The absence is the signal: a caller must be able to tell "kept nothing"
    // from "wrote nothing", because they are different things to say.
    expect(discardReports.history).toBeUndefined();
  });
});

describe('finding the table a player sits at', () => {
  /**
   * A room is keyed by the chat it lives in, which is right for every command
   * sent at the table. `/ask` is not one of those: the companion answers
   * privately, so the natural place to ask is a private chat — where there is
   * no table. A player seated in a group was told "take a seat first" while
   * holding a seat.
   */

  const seated = (chatId: string, ids: string[]): Room =>
    ({
      chatId,
      language: 'en',
      seed: 1,
      rollsTaken: 0,
      started: true,
      names: {},
      session: { players: ids.map((id) => ({ id, state: {}, reportSubmitted: true })) },
    }) as unknown as Room;

  it('finds it from anywhere, not only from the chat it lives in', async () => {
    const store = new MemoryRoomStore();
    await store.save(seated('-500', ['a', 'b']));

    expect((await store.roomOf('a'))?.chatId).toBe('-500');
  });

  it('is nothing for a player who sits at no table', async () => {
    const store = new MemoryRoomStore();
    await store.save(seated('-500', ['a']));

    expect(await store.roomOf('nobody')).toBeNull();
  });

  it('is the table they played most recently, when they sit at several', async () => {
    // A player can have a group game and a private one. The one they mean when
    // they ask a question is the one they last touched.
    const store = new MemoryRoomStore();
    await store.save(seated('-500', ['a']));
    await store.save(seated('900', ['a']));
    expect((await store.roomOf('a'))?.chatId).toBe('900');

    // Playing at the older one again makes it the newer one.
    await store.save(seated('-500', ['a']));
    expect((await store.roomOf('a'))?.chatId).toBe('-500');
  });

  it('forgets it with the table', async () => {
    const store = new MemoryRoomStore();
    await store.save(seated('-500', ['a']));
    await store.delete('-500');

    expect(await store.roomOf('a')).toBeNull();
  });
});
