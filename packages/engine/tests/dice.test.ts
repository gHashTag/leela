import { describe, expect, it } from 'vitest';
import { MAX_ROLL, noRepeatRoller, rollDie, rollMany, seededRoller } from '../src';

describe('rollDie', () => {
  it('only ever returns a face of the die', () => {
    for (let i = 0; i < 10_000; i++) {
      const value = rollDie();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(MAX_ROLL);
    }
  });

  it('reaches every face', () => {
    const seen = new Set(rollMany(rollDie, 1000));
    expect(seen.size).toBe(MAX_ROLL);
  });
});

describe('seededRoller', () => {
  it('gives the same sequence for the same seed', () => {
    expect(rollMany(seededRoller(42), 50)).toEqual(rollMany(seededRoller(42), 50));
  });

  it('gives different sequences for different seeds', () => {
    expect(rollMany(seededRoller(1), 30)).not.toEqual(rollMany(seededRoller(2), 30));
  });

  it('only ever returns a face of the die', () => {
    const roller = seededRoller(7);
    for (let i = 0; i < 10_000; i++) {
      const value = roller();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(MAX_ROLL);
    }
  });

  it('spreads reasonably evenly across the six faces', () => {
    const counts = new Map<number, number>();
    const roller = seededRoller(123);
    const n = 60_000;
    for (let i = 0; i < n; i++) {
      const value = roller();
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect(counts.size).toBe(MAX_ROLL);
    // Each face should land within 10% of a sixth of the throws.
    const expected = n / MAX_ROLL;
    for (const [face, count] of counts) {
      expect(Math.abs(count - expected) / expected, `face ${face}`).toBeLessThan(0.1);
    }
  });

  it('handles a seed of zero and a negative seed', () => {
    expect(rollMany(seededRoller(0), 10)).toHaveLength(10);
    expect(rollMany(seededRoller(-1), 10).every((v) => v >= 1 && v <= MAX_ROLL)).toBe(true);
  });
});

describe('noRepeatRoller', () => {
  it('reproduces the published app: one re-roll when the value repeats', () => {
    // A source that would otherwise hand out 6, 6, 6, 2.
    const scripted = [6, 6, 6, 2];
    let i = 0;
    const roller = noRepeatRoller(() => scripted[i++]);

    expect(roller()).toBe(6); // first 6, nothing to compare against
    expect(roller()).toBe(6); // second 6 repeats, re-rolled once, still 6
    expect(roller()).toBe(2); // third 6 repeats, re-rolled into 2
  });

  it('still only returns faces of the die', () => {
    const roller = noRepeatRoller(seededRoller(9));
    for (let i = 0; i < 5000; i++) {
      const value = roller();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(MAX_ROLL);
    }
  });

  it('makes an immediate repeat much rarer than a fair die', () => {
    const fair = rollMany(seededRoller(5), 20_000);
    const guarded = rollMany(noRepeatRoller(seededRoller(5)), 20_000);

    const repeats = (values: number[]) =>
      values.filter((v, i) => i > 0 && v === values[i - 1]).length;

    expect(repeats(guarded)).toBeLessThan(repeats(fair) / 2);
  });
});
