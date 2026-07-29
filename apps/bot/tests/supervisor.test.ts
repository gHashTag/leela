import { describe, expect, it } from 'vitest';
import {
  BASE_DELAY_MS,
  CONFLICT_DELAY_MS,
  MAX_DELAY_MS,
  decideRetry,
  supervise,
} from '../src/supervisor';

/** An error shaped like the one grammY throws for a Telegram API failure. */
function apiError(code: number, message = 'failed') {
  return Object.assign(new Error(message), { error_code: code });
}

describe('decideRetry', () => {
  it('retries a network failure, backing off', () => {
    const delays = [1, 2, 3, 4].map((n) => decideRetry(new Error('socket hang up'), n).delayMs);
    expect(delays).toEqual([
      BASE_DELAY_MS,
      BASE_DELAY_MS * 2,
      BASE_DELAY_MS * 4,
      BASE_DELAY_MS * 8,
    ]);
  });

  it('caps the backoff, so an outage does not park it for an hour', () => {
    expect(decideRetry(new Error('down'), 50).delayMs).toBe(MAX_DELAY_MS);
  });

  it('waits much longer on a 409, because two instances would fight', () => {
    const decision = decideRetry(apiError(409, 'Conflict'), 1);
    expect(decision.retry).toBe(true);
    expect(decision.delayMs).toBe(CONFLICT_DELAY_MS);
    expect(decision.note).toMatch(/another instance/i);
  });

  it('keeps the 409 delay flat rather than backing off into it', () => {
    // Backing off from 30s would take minutes to recover after the other
    // instance stops.
    for (const attempt of [1, 5, 20]) {
      expect(decideRetry(apiError(409), attempt).delayMs).toBe(CONFLICT_DELAY_MS);
    }
  });

  it('does not retry a rejected token, because retrying cannot fix it', () => {
    const decision = decideRetry(apiError(401, 'Unauthorized'), 1);
    expect(decision.retry).toBe(false);
    expect(decision.note).toMatch(/revoked/i);
  });

  it('retries a server error', () => {
    expect(decideRetry(apiError(502, 'Bad Gateway'), 1).retry).toBe(true);
  });

  it('gives up at the limit', () => {
    expect(decideRetry(new Error('x'), 3, 3).retry).toBe(false);
    expect(decideRetry(new Error('x'), 2, 3).retry).toBe(true);
  });

  it('treats anything without an error code as retryable', () => {
    for (const thrown of [new Error('boom'), 'a string', null, undefined, { nope: 1 }]) {
      expect(decideRetry(thrown, 1).retry, String(thrown)).toBe(true);
    }
  });
});

describe('supervise', () => {
  /** Collect log lines and skip the waiting. */
  function harness() {
    const lines: string[] = [];
    const waited: number[] = [];
    return {
      lines,
      waited,
      log: (m: string) => lines.push(m),
      sleep: async (ms: number) => {
        waited.push(ms);
      },
    };
  }

  it('stops when the bot returns cleanly', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
      },
      ...h,
    });

    expect(starts).toBe(1);
    expect(h.lines).toEqual([]);
  });

  it('brings the bot back after a crash', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        if (starts < 3) throw new Error('socket hang up');
      },
      ...h,
    });

    expect(starts).toBe(3);
    expect(h.waited).toEqual([BASE_DELAY_MS, BASE_DELAY_MS * 2]);
  });

  it('survives the failure that actually killed it — a 409 from a second poller', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        if (starts === 1) throw apiError(409, 'Conflict: terminated by other getUpdates request');
      },
      ...h,
    });

    expect(starts).toBe(2);
    expect(h.waited).toEqual([CONFLICT_DELAY_MS]);
    expect(h.lines.join('\n')).toMatch(/another instance/i);
  });

  it('stops on a revoked token instead of hammering the API', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        throw apiError(401, 'Unauthorized');
      },
      ...h,
    });

    expect(starts).toBe(1);
    expect(h.waited).toEqual([]);
  });

  it('honours a limit rather than looping forever', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        throw new Error('always down');
      },
      maxAttempts: 4,
      ...h,
    });

    expect(starts).toBe(4);
    expect(h.lines.join('\n')).toMatch(/giving up/i);
  });

  it('resets nothing between crashes — the backoff keeps growing while it is failing', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        throw new Error('down');
      },
      maxAttempts: 5,
      ...h,
    });

    expect(h.waited).toEqual([
      BASE_DELAY_MS,
      BASE_DELAY_MS * 2,
      BASE_DELAY_MS * 4,
      BASE_DELAY_MS * 8,
    ]);
  });

  it('says what went wrong, not just that something did', async () => {
    const h = harness();
    let starts = 0;

    await supervise({
      start: async () => {
        starts++;
        if (starts === 1) throw new Error('ETIMEDOUT');
      },
      ...h,
    });

    expect(h.lines[0]).toContain('ETIMEDOUT');
  });
});
