/** Paid access shared by chat rolls and mini-app rolls. */

import { FREE_MOVES } from '@leela/content';
import type { EntitlementStore, StepSink } from './store';
import type { PricedTier } from './stars';

export interface PlayAccess {
  /** Whether the die may turn now. */
  mayMove: boolean;
  /** Successful moves already consumed. */
  moved: number;
  /** Whether a live paid period was found. */
  entitled: boolean;
  /** Remaining free moves, or null when no paywall applies. */
  left: number | null;
}

/**
 * Three real moves are free. A dark Stars rail gates nothing, and a live
 * entitlement removes the gate. The move count is durable and per player, so
 * reopening the mini app or starting another table does not refill the trial.
 */
export async function accessFor({
  userId,
  stars,
  entitlements,
  steps,
  now,
}: {
  userId: string;
  stars: readonly PricedTier[] | null;
  entitlements: EntitlementStore;
  steps: StepSink;
  now: number;
}): Promise<PlayAccess> {
  if (stars === null) {
    return { mayMove: true, moved: 0, entitled: false, left: null };
  }

  const held = await entitlements.subscribed(userId, now);
  if (held !== null) {
    return { mayMove: true, moved: await steps.moved(userId), entitled: true, left: null };
  }

  const moved = Math.max(0, await steps.moved(userId));
  const left = Math.max(0, FREE_MOVES - moved);
  return { mayMove: left > 0, moved, entitled: false, left };
}
