/**
 * The rotation policy, ported from `gHashTag/trios`.
 *
 * These cases hold the decisions that file made, not the ones I would have
 * made. Two of them I would have got wrong, and they are marked: the LRU
 * ordering, and reading the provider's error code before the HTTP status.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  availableCount,
  freshState,
  isAvailable,
  nextKey,
  reasonFor,
  recordFailure,
  recordSuccess,
  reset,
  type KeyState,
} from '../src/key-rotation';

const NOW = 1_788_400_000_000;
const MINUTE = 60_000;
const none: Record<string, KeyState> = {};

describe('which key to use next', () => {
  it('takes a never-used key before any that has been used', () => {
    // So a key added while the pool is running is exercised now rather than
    // after the whole cycle. It is also how an operator sees a new key work.
    const states = recordSuccess('a', none, NOW - MINUTE);
    expect(nextKey(['a', 'b'], states, NOW)).toBe('b');
  });

  it('otherwise takes the least recently used', () => {
    let states = recordSuccess('a', none, NOW - 3 * MINUTE);
    states = recordSuccess('b', states, NOW - MINUTE);
    expect(nextKey(['a', 'b'], states, NOW)).toBe('a');
  });

  it('breaks a tie by id, so the choice is not left to object order', () => {
    let states = recordSuccess('b', none, NOW - MINUTE);
    states = recordSuccess('a', states, NOW - MINUTE);
    expect(nextKey(['b', 'a'], states, NOW)).toBe('a');
    expect(nextKey(['a', 'b'], states, NOW)).toBe('a');
  });

  it('survives a key being removed from the pool mid-session', () => {
    // The reason trios chose LRU over round-robin, asserted rather than
    // quoted: an index-based rotation pointing at slot 1 of three either skips
    // or repeats when the list becomes two. LRU has no index to invalidate.
    let states = recordSuccess('a', none, NOW - 3 * MINUTE);
    states = recordSuccess('b', states, NOW - 2 * MINUTE);
    states = recordSuccess('c', states, NOW - MINUTE);
    expect(nextKey(['b', 'c'], states, NOW)).toBe('b');
    expect(nextKey(['c'], states, NOW)).toBe('c');
  });

  it('passes over a key that is cooling down', () => {
    const states = recordFailure('a', 'rate-limited', null, none, NOW);
    expect(nextKey(['a', 'b'], states, NOW)).toBe('b');
  });

  it('comes back to it once the cooldown expires', () => {
    const states = recordFailure('a', 'rate-limited', null, none, NOW);
    expect(nextKey(['a'], states, NOW)).toBeNull();
    expect(nextKey(['a'], states, NOW + DEFAULT_RATE_LIMIT_COOLDOWN_MS)).toBe('a');
  });

  it('never comes back to a depleted or rejected one by waiting', () => {
    for (const reason of ['depleted', 'rejected'] as const) {
      const states = recordFailure('a', reason, null, none, NOW);
      expect(nextKey(['a'], states, NOW)).toBeNull();
      expect(nextKey(['a'], states, NOW + 365 * 24 * 3600_000)).toBeNull();
    }
  });

  it('answers null rather than handing back a key known to fail', () => {
    // A caller must decide what to say. Sending without credentials to keep a
    // loop tidy is how an outage becomes a mystery.
    const states = recordFailure('a', 'depleted', null, none, NOW);
    expect(nextKey(['a'], states, NOW)).toBeNull();
    expect(availableCount(['a'], states, NOW)).toBe(0);
  });

  it('treats an unknown key as usable', () => {
    expect(nextKey(['brand-new'], none, NOW)).toBe('brand-new');
    expect(isAvailable(undefined, NOW)).toBe(true);
    expect(isAvailable(freshState(), NOW)).toBe(true);
  });
});

describe('what a response means for the key that made it', () => {
  it('separates a rate limit from an exhausted package, though both are 429', () => {
    // THE distinction. Waiting fixes one and never fixes the other, so reading
    // the status first — which is what a switch statement invites — retries an
    // unpayable key every minute forever.
    expect(reasonFor(429, null)).toBe('rate-limited');
    expect(reasonFor(429, '1113')).toBe('depleted');
  });

  it('honours the provider code even on a status that means nothing else', () => {
    expect(reasonFor(200, '1113')).toBe('depleted');
  });

  it('parks a rejected key and reads 402 as depleted', () => {
    expect(reasonFor(401)).toBe('rejected');
    expect(reasonFor(403)).toBe('rejected');
    expect(reasonFor(402)).toBe('depleted');
  });

  it('says nothing about the key when the provider is merely broken', () => {
    // The control that keeps the pool from shrinking for the wrong reason: a
    // 500 or a 503 is the provider having a bad day, not a bad credential.
    for (const status of [200, 400, 404, 500, 502, 503]) {
      expect(reasonFor(status, null)).toBeNull();
    }
  });
});

describe('recording what happened', () => {
  it('clears a cooldown when the key itself succeeds', () => {
    const parked = recordFailure('a', 'rate-limited', null, none, NOW);
    const healed = recordSuccess('a', parked, NOW + MINUTE);
    expect(healed.a?.cooldownReason).toBeNull();
    expect(isAvailable(healed.a, NOW + MINUTE)).toBe(true);
  });

  it('clears even a terminal park, because the key just worked', () => {
    // A success is stronger evidence than any earlier verdict: it is the same
    // key answering now. This is how a topped-up account rejoins the pool
    // without anybody restarting anything.
    const parked = recordFailure('a', 'depleted', null, none, NOW);
    const healed = recordSuccess('a', parked, NOW + MINUTE);
    expect(healed.a?.cooldownReason).toBeNull();
  });

  it('honours the provider\'s own Retry-After over the default', () => {
    const states = recordFailure('a', 'rate-limited', 5 * MINUTE, none, NOW);
    expect(nextKey(['a'], states, NOW + DEFAULT_RATE_LIMIT_COOLDOWN_MS)).toBeNull();
    expect(nextKey(['a'], states, NOW + 5 * MINUTE)).toBe('a');
  });

  it('ignores Retry-After for a terminal reason', () => {
    const states = recordFailure('a', 'depleted', MINUTE, none, NOW);
    expect(states.a?.cooldownUntil).toBeNull();
  });

  it('counts successes and failures separately', () => {
    let states = recordSuccess('a', none, NOW);
    states = recordFailure('a', 'rate-limited', null, states, NOW + 1);
    states = recordSuccess('a', states, NOW + 2);
    expect(states.a).toMatchObject({ successes: 2, failures: 1 });
  });

  it('lets a topped-up key be un-parked by hand', () => {
    const parked = recordFailure('a', 'depleted', null, none, NOW);
    expect(nextKey(['a'], parked, NOW)).toBeNull();
    expect(nextKey(['a'], reset('a', parked), NOW)).toBe('a');
  });

  it('does not invent state for a key it has never seen', () => {
    expect(reset('nobody', none)).toEqual({});
  });

  it('mutates nothing it was given', () => {
    // Pure, like the Swift original, so the whole policy is testable without a
    // provider and a caller can keep its state wherever it likes.
    const before = recordSuccess('a', none, NOW);
    const snapshot = JSON.parse(JSON.stringify(before)) as unknown;
    recordFailure('a', 'depleted', null, before, NOW + 1);
    reset('a', before);
    expect(before).toEqual(snapshot);
  });
});
