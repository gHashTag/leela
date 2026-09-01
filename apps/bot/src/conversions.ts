import type { NudgeConversion, NudgeStore } from './store';

interface ConversionOptions {
  nudges: NudgeStore;
  userId: string;
  kind: NudgeConversion;
  at: number;
  log?: (message: string) => void;
}

/**
 * Attribute an accepted action to the latest daily word without making
 * analytics part of the game transaction.
 *
 * The store receives the player id only to find their latest nudge row. Logs
 * deliberately name neither the player nor the error: a database driver can
 * echo bound values in an exception, and an engagement counter is not worth
 * turning an identifier into operational telemetry.
 */
export async function attributeConversion({
  nudges,
  userId,
  kind,
  at,
  log = console.log,
}: ConversionOptions): Promise<boolean> {
  try {
    // Successful events stay silent: even an anonymous line could be joined
    // to the transport's adjacent inbound log by time. The next cohort
    // summary is the one place success is said, as aggregate counts only.
    return await nudges.convert(userId, kind, at);
  } catch {
    try {
      log(`[initiative] ${kind} conversion could not be recorded.`);
    } catch {
      // Diagnostics are even less important than the metric they describe.
    }
    return false;
  }
}
