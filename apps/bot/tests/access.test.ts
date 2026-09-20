import { describe, expect, it } from 'vitest';
import { accessFor } from '../src/access';
import { openRoom, report, roll, start, type Room } from '../src/commands';
import { MemoryEntitlementStore } from '../src/store';
import type { PricedTier } from '../src/stars';

const NOW = 1_800_000_000_000;
const TIERS: readonly PricedTier[] = [{ id: 'month', stars: 150, days: 30 }];

const opened = (seed = 1): Room => {
  const room = openRoom('chat', { id: '7', name: 'Ada' }, seed).room as Room;
  return start(room, '7').room as Room;
};

const withMoves = (wanted: number): Room => {
  let room = opened(4);
  let at = NOW;
  let moved = 0;
  for (let guard = 0; moved < wanted && guard < 200; guard += 1) {
    if (room.session.players[0]?.reportSubmitted === false && room.session.players[0].state.loka > 0) {
      room = (report(room, '7', `A sufficiently long account ${guard}`, at).room ?? room);
    }
    at += 60_000;
    const result = roll(room, '7', at);
    const event = result.effects?.find((effect) => effect.kind === 'move');
    room = result.room ?? room;
    if (event?.kind === 'move' && event.event.from !== event.event.to) moved += 1;
  }
  if (moved !== wanted) throw new Error(`could not build ${wanted} movements`);
  return room;
};

describe('the Telegram free-move allowance', () => {
  it('counts actual movement, not a refused attempt', async () => {
    const room = opened(1);
    const thrown = roll(room, '7', NOW);
    const after = thrown.room as Room;
    expect(thrown.effects?.[0]?.kind).toBe('move');
    expect(await accessFor(after, '7', new MemoryEntitlementStore(), TIERS, NOW)).toMatchObject({
      movesUsed: 0,
      left: 3,
      mayRoll: true,
    });
  });

  it('closes after exactly three movements and a receipt reopens it', async () => {
    const room = withMoves(3);
    const entitlements = new MemoryEntitlementStore();
    expect(await accessFor(room, '7', entitlements, TIERS, NOW)).toMatchObject({
      movesUsed: 3,
      left: 0,
      mayRoll: false,
    });

    await entitlements.record({
      userId: '7', chargeId: 'charge', tier: 'month', stars: 150, days: 30, at: NOW,
    });
    expect(await accessFor(room, '7', entitlements, TIERS, NOW)).toMatchObject({
      movesUsed: 3,
      left: null,
      mayRoll: true,
    });
  });

  it('never arms an unpayable gate', async () => {
    expect(await accessFor(withMoves(3), '7', new MemoryEntitlementStore(), null, NOW)).toMatchObject({
      enabled: false,
      mayRoll: true,
      left: null,
    });
  });
});
