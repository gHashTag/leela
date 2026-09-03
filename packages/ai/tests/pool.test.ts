/**
 * The pool: does a second key actually get used, and does a bad one stay out?
 *
 * `key-rotation.test.ts` holds the policy. This holds the part that could still
 * be wrong with a perfect policy — that a refusal is classified from the real
 * `ModelError`, that the failing request is retried rather than lost, and that
 * a pool which has run out says so instead of degrading quietly.
 */

import { describe, expect, it, vi } from 'vitest';
import { ModelError, type LanguageModel } from '../src/model';
import { keysFrom, pooled } from '../src/pool';

const NOW = 1_788_400_000_000;

/** A model that fails a given number of times, then answers. */
const model = (id: string, script: Array<ModelError | string>): LanguageModel => {
  let turn = 0;
  return {
    id,
    async complete() {
      const next = script[Math.min(turn, script.length - 1)];
      turn += 1;
      if (next instanceof ModelError) throw next;
      return next as string;
    },
  };
};

const depleted = () => new ModelError('no balance', 429, '1113');
const limited = () => new ModelError('slow down', 429);
const broken = () => new ModelError('provider is down', 503);

const build = (
  scripts: Array<Array<ModelError | string>>,
  log: (m: string) => void = () => undefined,
) => {
  const used: string[] = [];
  const pool = pooled({
    keys: scripts.map((_, i) => `secret-${i}`),
    modelFor: (key) => {
      const index = Number(key.split('-')[1]);
      const inner = model(`m${index}`, scripts[index] as Array<ModelError | string>);
      return {
        id: inner.id,
        async complete(messages, options) {
          used.push(inner.id);
          return inner.complete(messages, options);
        },
      };
    },
    now: () => NOW,
    log,
  });
  return { pool, used };
};

const ask = (pool: LanguageModel) => pool.complete([{ role: 'user', content: 'hi' }]);

describe('a pool of keys', () => {
  it('answers from the first key when it works', async () => {
    const { pool, used } = build([['ok'], ['unused']]);
    await expect(ask(pool)).resolves.toBe('ok');
    expect(used).toEqual(['m0']);
  });

  it('rolls to the next key when the first is depleted, and answers', async () => {
    // The whole point. On 2026-09-03 this request returned canonical text
    // while a working key sat unused.
    const { pool, used } = build([[depleted()], ['ok']]);
    await expect(ask(pool)).resolves.toBe('ok');
    expect(used).toEqual(['m0', 'm1']);
  });

  it('does not go back to a depleted key on the next request', async () => {
    const { pool, used } = build([[depleted()], ['ok', 'ok again']]);
    await ask(pool);
    await expect(ask(pool)).resolves.toBe('ok again');
    expect(used).toEqual(['m0', 'm1', 'm1']);
  });

  it('raises when every key is parked, naming how many and why', async () => {
    const { pool } = build([[depleted()], [depleted()]]);
    await expect(ask(pool)).rejects.toThrow();
    await expect(ask(pool)).rejects.toThrow(/every key in the pool of 2 is parked.*depleted/);
  });

  it('does not spend the pool on a fault that is not about the key', async () => {
    // A 503 would fail identically on every key. Three requests to produce one
    // 503 is worse than one, and it hides the outage behind a longer wait.
    const { pool, used } = build([[broken()], ['never reached']]);
    await expect(ask(pool)).rejects.toThrow('provider is down');
    expect(used).toEqual(['m0']);
  });

  it('lets a rate-limited key back in after its cooldown', async () => {
    const clock = vi.fn(() => NOW);
    const pool = pooled({
      keys: ['a', 'b'],
      modelFor: (key) =>
        key === 'a'
          ? model('ma', [limited(), 'a is back'])
          : model('mb', ['b answered']),
      now: clock,
    });

    await expect(ask(pool)).resolves.toBe('b answered');
    clock.mockReturnValue(NOW + 61_000);
    // `a` is least-recently-used again once its cooldown expires.
    await expect(ask(pool)).resolves.toBe('a is back');
  });

  it('tells the operator which key was parked, and never the key itself', async () => {
    const said: string[] = [];
    const { pool } = build([[depleted()], ['ok']], (m) => said.push(m));
    await ask(pool);
    expect(said[0]).toContain('key #1');
    expect(said[0]).toContain('depleted');
    expect(said[0]).toContain('1 of 2');
    // The control that matters: no fragment of any secret in any line.
    for (const line of said) expect(line).not.toContain('secret-');
  });

  it('refuses to be built with no keys at all', async () => {
    expect(() => pooled({ keys: [], modelFor: () => model('x', ['']) })).toThrow(
      'a pool needs at least one key',
    );
  });
});

describe('reading the keys out of the environment', () => {
  it('takes the numbered variables in order', () => {
    expect(
      keysFrom('ZAI_API_KEY', {
        ZAI_API_KEY: 'one',
        ZAI_API_KEY_2: 'two',
        ZAI_API_KEY_3: 'three',
      }),
    ).toEqual(['one', 'two', 'three']);
  });

  it('drops a blank, which is how a key is retired in a dashboard', () => {
    // A counted blank would report a usable key the pool does not have, and
    // the count is what an operator reads to decide whether to go and buy one.
    expect(keysFrom('K', { K: 'one', K_2: '   ', K_3: 'three' })).toEqual(['one', 'three']);
  });

  it('drops a duplicate, so one key pasted twice is not two chances', () => {
    expect(keysFrom('K', { K: 'same', K_2: 'same' })).toEqual(['same']);
  });

  it('survives a gap in the numbering', () => {
    expect(keysFrom('K', { K: 'one', K_4: 'four' })).toEqual(['one', 'four']);
  });

  it('returns nothing when nothing is set', () => {
    expect(keysFrom('K', {})).toEqual([]);
    expect(keysFrom('K', { K: '' })).toEqual([]);
  });
});
