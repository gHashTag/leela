/**
 * Keeping the bot up.
 *
 * `bot.catch` handles a failing update. It does not handle a failing *poll* —
 * a network blip or a second instance calling `getUpdates` throws out of the
 * run loop and takes the process with it. A bot meant to run overnight cannot
 * die because a request timed out once.
 *
 * The retry policy is a pure function so it can be tested without waiting.
 */

/** How long to wait before the next attempt, and whether to try at all. */
export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  /** What to tell the operator. Empty when there is nothing worth saying. */
  note: string;
}

export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 60_000;

/**
 * A 409 means another process is polling the same token. Restarting
 * immediately makes it worse: the two instances take turns killing each other.
 * Back off hard and say so, because the fix is a human one — stop the other
 * instance, or use a different token.
 */
export const CONFLICT_DELAY_MS = 30_000;

/** Telegram's error code, when the failure came from the API. */
function errorCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { error_code?: unknown }).error_code;
  return typeof code === 'number' ? code : null;
}

/**
 * Decide what to do after the poll loop threw.
 *
 * @param attempt  How many consecutive failures have happened, starting at 1.
 * @param maxAttempts  Give up after this many. `Infinity` to never give up.
 */
export function decideRetry(
  error: unknown,
  attempt: number,
  maxAttempts = Infinity,
): RetryDecision {
  if (attempt >= maxAttempts) {
    return { retry: false, delayMs: 0, note: `giving up after ${attempt} attempts` };
  }

  const code = errorCodeOf(error);

  if (code === 409) {
    return {
      retry: true,
      delayMs: CONFLICT_DELAY_MS,
      note:
        'another instance is polling this token. ' +
        'Stop it, or give this one its own token from @BotFather.',
    };
  }

  // 401 is a revoked or mistyped token. Retrying cannot fix it.
  if (code === 401) {
    return { retry: false, delayMs: 0, note: 'the token was rejected — it may have been revoked' };
  }

  // Everything else — timeouts, 5xx, a dropped socket — is worth retrying,
  // backing off so a sustained outage does not become a request flood.
  const delayMs = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return { retry: true, delayMs, note: '' };
}

export interface SuperviseOptions {
  /** Starts the bot and resolves only when it stops. */
  start: () => Promise<void>;
  /** Sleep. Injected so tests do not wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Where to report. Injected so tests can read it. */
  log?: (message: string) => void;
  maxAttempts?: number;
}

/**
 * Run `start`, and bring it back when it falls over.
 *
 * A clean return means the bot was asked to stop; that ends supervision. Only
 * a throw is treated as a crash.
 */
export async function supervise({
  start,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.error,
  maxAttempts = Infinity,
}: SuperviseOptions): Promise<void> {
  let attempt = 0;

  for (;;) {
    try {
      await start();
      return; // asked to stop
    } catch (error) {
      attempt++;
      const decision = decideRetry(error, attempt, maxAttempts);
      const reason = error instanceof Error ? error.message : String(error);

      log(`[bot] polling failed (attempt ${attempt}): ${reason}`);
      if (decision.note) log(`[bot] ${decision.note}`);

      if (!decision.retry) return;

      log(`[bot] retrying in ${Math.round(decision.delayMs / 1000)}s`);
      await sleep(decision.delayMs);
    }
  }
}
