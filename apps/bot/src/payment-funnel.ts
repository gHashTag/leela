/** Privacy-minimal attribution for the paid-play journey. */

import type { PaymentFunnelStore, PaymentMilestone, PaymentFunnelSummary } from './store';

/** Record one first-player milestone without making analytics part of gameplay. */
export async function attributePaymentStage({
  funnel,
  userId,
  stage,
  at,
  log = console.log,
}: {
  funnel: PaymentFunnelStore;
  userId: string;
  stage: PaymentMilestone;
  at: number;
  log?: (message: string) => void;
}): Promise<boolean> {
  try {
    await funnel.record(userId, stage, at);
    return true;
  } catch {
    // Neither the identifier nor the storage error belongs in a line written
    // beside an inbound Telegram update: either can correlate the milestone
    // back to a player. The stage is aggregate vocabulary and safe to name.
    try {
      log(`[payments] ${stage} milestone could not be recorded.`);
    } catch {
      // Metrics and their logger are both optional to the game.
    }
    return false;
  }
}

/** The one aggregate operator sentence; no event emits a success line. */
export function funnelSaid(summary: PaymentFunnelSummary): string {
  return (
    `Payment funnel: trial ${summary.trial}, paywall ${summary.paywall}, ` +
    `invoice ${summary.invoice}, purchase ${summary.purchase}, return ${summary.return}.`
  );
}
