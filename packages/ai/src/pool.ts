/**
 * One model over several keys.
 *
 * `configuredModel` takes the first key present and never tries another, so on
 * 2026-09-03 one exhausted account answered the chat and the board with
 * canonical text for most of a day while a working key sat unused in another
 * account. This is the repair: the pool asks the rotation policy which key to
 * use, and when a request fails for a reason that is ABOUT THE KEY it parks
 * that one and immediately tries the next.
 *
 * The policy is `key-rotation.ts`, ported from `gHashTag/trios`. This file is
 * only the part that knows about HTTP and about `ModelError`.
 *
 * ## What it will not do
 *
 * It does not retry on a failure that is not about the key. A 500 is the
 * provider having a bad day and a second key would fail identically, so the
 * error is raised the first time — three keys spending three requests to
 * produce one identical 500 is worse than one, and it hides the outage behind
 * a longer wait.
 *
 * It does not fall back to "no key". When every key is parked it raises, and
 * says how many there were and why they are parked. A companion that silently
 * degrades is the thing that took a day to notice.
 */

import { ModelError, type CompletionOptions, type LanguageModel } from './model';
import type { Message } from './prompts';
import {
  availableCount,
  nextKey,
  reasonFor,
  recordFailure,
  recordSuccess,
  type KeyState,
} from './key-rotation';

export interface PooledOptions {
  /** The keys, in the order they were configured. At least one. */
  readonly keys: readonly string[];
  /** Builds a model for one key. One per key, made once. */
  readonly modelFor: (key: string) => LanguageModel;
  /** For tests. */
  readonly now?: () => number;
  /** Told which key was parked and why, never the key itself. */
  readonly log?: (message: string) => void;
}

/** A key's name in a log line: its position, never any of its characters. */
const nameOf = (index: number): string => `key #${index + 1}`;

/**
 * A `LanguageModel` that spends the pool rather than one key.
 *
 * State lives in the closure: the pool is built once at startup and lives as
 * long as the process, which is what makes a cooldown mean anything. A pool
 * rebuilt per request would forget every park and hammer a depleted key on
 * every message.
 */
export function pooled({
  keys,
  modelFor,
  now = Date.now,
  log = () => undefined,
}: PooledOptions): LanguageModel {
  if (keys.length === 0) {
    throw new ModelError('a pool needs at least one key');
  }

  // Keyed by position rather than by the secret, so nothing here can print one
  // even by accident, and two identical keys stay two entries.
  const ids = keys.map((_, index) => nameOf(index));
  const models = new Map(ids.map((id, index) => [id, modelFor(keys[index] as string)]));
  let states: Record<string, KeyState> = {};

  const complete = async (messages: Message[], options?: CompletionOptions): Promise<string> => {
    const tried: string[] = [];

    for (;;) {
      const id = nextKey(ids, states, now());
      if (id === null) {
        const why = ids
          .map((one) => `${one}: ${states[one]?.cooldownReason ?? 'unused'}`)
          .join(', ');
        throw new ModelError(
          `every key in the pool of ${ids.length} is parked (${why})`,
        );
      }

      try {
        const said = await (models.get(id) as LanguageModel).complete(messages, options);
        states = recordSuccess(id, states, now());
        return said;
      } catch (error) {
        const failure = error instanceof ModelError ? error : undefined;
        const reason = reasonFor(failure?.status ?? 0, failure?.providerCode ?? null);
        if (reason === null) {
          // Not about the key. Raise it now rather than spending the pool on a
          // fault every member would hit identically.
          throw error;
        }
        states = recordFailure(id, reason, null, states, now());
        tried.push(id);
        log(
          `[ai] ${id} parked: ${reason}; ` +
            `${availableCount(ids, states, now())} of ${ids.length} key(s) still usable.`,
        );
        if (tried.length >= ids.length) throw error;
      }
    }
  };

  return {
    id: `pool(${ids.length})`,
    complete,
  };
}

/**
 * The keys a deployment configured, in order.
 *
 * `ZAI_API_KEY`, then `ZAI_API_KEY_2`, `_3`, … up to `_9`. Numbered rather than
 * comma-separated in one variable, because a dashboard that shows one long
 * secret makes it impossible to see which of them you are replacing, and
 * because a stray comma would silently produce a key that fails as `rejected`.
 *
 * Blanks and duplicates are dropped: a variable set to an empty string is how a
 * key gets retired in a dashboard, and a pool that counted it would report
 * usable keys it does not have.
 */
export function keysFrom(
  prefix: string,
  env: Record<string, string | undefined>,
): string[] {
  const raw = [env[prefix], ...Array.from({ length: 8 }, (_, i) => env[`${prefix}_${i + 2}`])];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const one of raw) {
    const key = one?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}
