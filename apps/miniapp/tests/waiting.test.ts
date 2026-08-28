import { describe as group, expect, it } from 'vitest';

import { PATIENCE_MS, until } from './waiting';

/**
 * The wait four suites depend on.
 *
 * It was written out four times, drifted into three different deadlines — 400,
 * 600 and 900 attempts — and had no test of its own in any of its copies. Its
 * whole value on a bad day is the sentence it throws, and nothing had ever read
 * that sentence.
 */
group('waiting for the app', () => {
  it('returns at once when the thing is already true', async () => {
    const began = Date.now();
    await until(() => true, 'nothing at all');

    expect(Date.now() - began).toBeLessThan(50);
  });

  it('returns as soon as it becomes true, without waiting out the bound', async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 30);

    const began = Date.now();
    await until(() => ready, 'the thing');

    expect(Date.now() - began).toBeLessThan(PATIENCE_MS / 2);
  });

  it('names what it waited for, because a bare timeout teaches nobody', async () => {
    await expect(until(() => false, 'the die to open', undefined, 40)).rejects.toThrow(
      /waited 40ms for the die to open/,
    );
  });

  it('carries the state that explains it, when the caller offers one', async () => {
    // `the-end-of-a-game` printed the plan, the sentence and whether the die was
    // shut. That was the best of the four copies and is the reason `describe`
    // exists rather than being dropped when they became one.
    await expect(
      until(() => false, 'the die to open', () => 'on 68, "you have arrived", die shut', 40),
    ).rejects.toThrow(/— on 68, "you have arrived", die shut/);
  });

  it('does not call describe when it succeeds', async () => {
    let asked = 0;
    await until(() => true, 'nothing', () => String(asked++));

    expect(asked).toBe(0);
  });

  it('waits at least as long as it was given', async () => {
    const began = Date.now();
    await expect(until(() => false, 'never', undefined, 120)).rejects.toThrow();

    expect(Date.now() - began).toBeGreaterThanOrEqual(120);
  });

  it('is a clock, not a count of attempts', async () => {
    /*
     * Asked with NO patience at all, because that is the one case where the two
     * implementations are far apart: a clock gives up at once, and the count
     * this replaced would poll six hundred times at 10 ms — about six seconds —
     * whatever it was told.
     *
     * The first version of this test asserted `took < 400` after a 120 ms
     * patience, and **it went red at a clean checkout the next morning**: an
     * upper bound on wall-clock is exactly what a loaded machine breaks, which
     * is the whole subject of the file it was testing. One second against six
     * is a margin load cannot close, and the lower bound above is what proves
     * the patience is honoured.
     */
    const began = Date.now();
    await expect(until(() => false, 'never', undefined, 0)).rejects.toThrow();

    expect(Date.now() - began).toBeLessThan(1_000);
  });

  it('loses the race to vitest on purpose', () => {
    // Under `--testTimeout=30000`. When vitest wins it prints "Test timed out"
    // and nothing about what was awaited; when this wins the failure names it.
    expect(PATIENCE_MS).toBeLessThan(30_000);
  });
});
