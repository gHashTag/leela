import { FREE_MOVES } from '@leela/journal';
import type { Room } from './commands';
import { roomHistory } from './room-history';
import type { PricedTier } from './stars';
import type { EntitlementStore } from './store';

export interface PlayerAccess {
  enabled: boolean;
  mayRoll: boolean;
  freeMoves: number;
  movesUsed: number;
  left: number | null;
  entitledUntil: number | null;
  tiers: readonly PricedTier[];
}

/** One server-owned decision shared by chat and Mini App. */
export async function accessFor(
  room: Room,
  userId: string,
  entitlements: EntitlementStore,
  tiers: readonly PricedTier[] | null,
  now: number,
): Promise<PlayerAccess> {
  const enabled = tiers !== null && tiers.length > 0;
  if (!enabled) {
    return {
      enabled: false,
      mayRoll: true,
      freeMoves: FREE_MOVES,
      movesUsed: 0,
      left: null,
      entitledUntil: null,
      tiers: [],
    };
  }
  const seat = room.session.players.findIndex(({ id }) => id === userId);
  const movesUsed = seat < 0 ? 0 : (roomHistory(room).moves[seat] ?? 0);
  const live = await entitlements.subscribed(userId, now);
  const left = !live ? Math.max(0, FREE_MOVES - movesUsed) : null;
  return {
    enabled,
    mayRoll: live !== null || (left ?? 0) > 0,
    freeMoves: FREE_MOVES,
    movesUsed,
    left,
    entitledUntil: live?.until ?? null,
    tiers: tiers ?? [],
  };
}
