import { describe, expect, it } from 'vitest';
import { openRoom, type Room } from '../src/commands';
import { MemoryReportSink, MemoryRoomStore, discardReports, seedFor } from '../src/store';

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
