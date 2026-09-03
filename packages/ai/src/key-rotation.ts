/**
 * Choosing which of several API keys to use next.
 *
 * A port of `ModelKeyRotation.swift` from `gHashTag/trios`
 * (`apps/trios-macos/rings/SR-00/`), which was written for this exact problem
 * and had already made the decisions that matter. The policy is not reinvented
 * here; only the language is different. Where a rule below looks arbitrary it
 * came from there, and the Swift file and its test are the place to argue.
 *
 * ## Why this exists at all
 *
 * `configuredModel` takes the first key present and never tries another, so one
 * exhausted account silences the companion on every surface. That happened on
 * 2026-09-03: the chat and the board both answered with canonical text for most
 * of a day while a working key sat unused in the owner's other account.
 *
 * ## The distinction the whole thing turns on
 *
 * **`429` alone and `429` with Z.AI's code `1113` are opposite facts.** A rate
 * limit recovers by waiting; an exhausted resource package does not recover
 * without somebody paying, so retrying it burns a request every time. The
 * provider's own error code is therefore read BEFORE the HTTP status, and it
 * is the reason `reasonFor` cannot be written as a `switch` on the status.
 *
 * And `1113` itself is not what it says. `trios/apps/trios-macos/.trinity/
 * ZAI-ENDPOINT-FACTS.md`, written 2026-07-28, opens with *"DO NOT tell the user
 * to top up the Z.AI balance on the strength of code 1113 alone"* — because a
 * Coding Plan key answers `1113` on the pay-as-you-go host while working
 * perfectly on the coding one. Rotation parks such a key as depleted, which is
 * correct for THIS host and says nothing about the key. Fixing the host is a
 * configuration question (`ZAI_PLAN`), not a rotation one.
 */

/** Why a key is currently unusable. */
export type CooldownReason =
  /** The provider answered 429. Recovers on its own. */
  | 'rate-limited'
  /** Balance or package exhausted (Z.AI code 1113). Does not recover by waiting. */
  | 'depleted'
  /** The key was rejected (401/403). Parked until somebody fixes it. */
  | 'rejected';

/** A parked key that waiting will not un-park. */
export const isTerminal = (reason: CooldownReason): boolean => reason !== 'rate-limited';

/** Rotation state for one key. */
export interface KeyState {
  /** Epoch milliseconds, or null when the key has never been used. */
  readonly lastUsedAt: number | null;
  /** Epoch milliseconds; meaningless for a terminal reason. */
  readonly cooldownUntil: number | null;
  readonly cooldownReason: CooldownReason | null;
  readonly successes: number;
  readonly failures: number;
}

export const freshState = (): KeyState => ({
  lastUsedAt: null,
  cooldownUntil: null,
  cooldownReason: null,
  successes: 0,
  failures: 0,
});

/** Default pause after a rate limit the provider gave no `Retry-After` for. */
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;

/** Z.AI's business code for an exhausted balance or resource package. */
export const ZAI_INSUFFICIENT_BALANCE = '1113';

export const isAvailable = (state: KeyState | undefined, now: number): boolean => {
  if (state?.cooldownReason == null) return true;
  if (isTerminal(state.cooldownReason)) return false;
  return state.cooldownUntil === null || now >= state.cooldownUntil;
};

/**
 * The next key to use, or `null` when every one of them is parked.
 *
 * Least-recently-used rather than round-robin, and that is the one design
 * choice worth reading twice: an index-based rotation silently skips or repeats
 * entries when keys are added or removed mid-session, and this pool is edited
 * by hand in a dashboard. Never-used keys come first so a freshly added one is
 * exercised promptly instead of waiting out the whole cycle.
 *
 * `null` is returned rather than a key that is known to fail, so a caller has
 * to decide what to say. Sending without credentials to keep a loop tidy is
 * how an outage becomes a mystery.
 */
export function nextKey(
  ids: readonly string[],
  states: Readonly<Record<string, KeyState>>,
  now: number,
): string | null {
  const available = ids.filter((id) => isAvailable(states[id], now));
  if (available.length === 0) return null;

  const neverUsed = available.find((id) => (states[id]?.lastUsedAt ?? null) === null);
  if (neverUsed !== undefined) return neverUsed;

  return available.reduce((best, id) => {
    const a = states[id]?.lastUsedAt ?? Number.NEGATIVE_INFINITY;
    const b = states[best]?.lastUsedAt ?? Number.NEGATIVE_INFINITY;
    if (a === b) return id < best ? id : best;
    return a < b ? id : best;
  });
}

/** A success clears any park: this very key has just proved it works. */
export function recordSuccess(
  id: string,
  states: Readonly<Record<string, KeyState>>,
  now: number,
): Record<string, KeyState> {
  const was = states[id] ?? freshState();
  return {
    ...states,
    [id]: {
      lastUsedAt: now,
      cooldownUntil: null,
      cooldownReason: null,
      successes: was.successes + 1,
      failures: was.failures,
    },
  };
}

/**
 * Park a key after a failure.
 *
 * `retryAfterMs` honours the provider's own advice when it gives any. A
 * terminal reason ignores it, because there is no deadline after which an
 * unpaid account starts working.
 */
export function recordFailure(
  id: string,
  reason: CooldownReason,
  retryAfterMs: number | null,
  states: Readonly<Record<string, KeyState>>,
  now: number,
): Record<string, KeyState> {
  const was = states[id] ?? freshState();
  return {
    ...states,
    [id]: {
      lastUsedAt: now,
      cooldownUntil: isTerminal(reason)
        ? null
        : now + Math.max(1, retryAfterMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS),
      cooldownReason: reason,
      successes: was.successes,
      failures: was.failures + 1,
    },
  };
}

/** Un-park a key, for when somebody has topped it up. */
export function reset(
  id: string,
  states: Readonly<Record<string, KeyState>>,
): Record<string, KeyState> {
  const was = states[id];
  if (was === undefined) return { ...states };
  return { ...states, [id]: { ...was, cooldownUntil: null, cooldownReason: null } };
}

/** How many keys are usable right now, for an operator line. */
export const availableCount = (
  ids: readonly string[],
  states: Readonly<Record<string, KeyState>>,
  now: number,
): number => ids.filter((id) => isAvailable(states[id], now)).length;

/**
 * What a response means for the key that made it.
 *
 * `null` when the outcome is not about the credential — a 500 is the provider
 * having a bad day and parking a good key for it would shrink the pool for no
 * reason.
 *
 * The provider code is read FIRST. `429` with `1113` is depleted and terminal;
 * `429` without it is a rate limit that clears itself. Reading the status first
 * collapses those two into one, and the collapsed version retries an unpayable
 * key every minute forever.
 */
export function reasonFor(status: number, providerCode?: string | null): CooldownReason | null {
  if (providerCode != null && String(providerCode) === ZAI_INSUFFICIENT_BALANCE) {
    return 'depleted';
  }
  if (status === 401 || status === 403) return 'rejected';
  if (status === 402) return 'depleted';
  if (status === 429) return 'rate-limited';
  return null;
}
