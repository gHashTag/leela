import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  MAX_ROLL,
  NEUROLEELA,
  ONCHAIN,
  ONLINE,
  RULESETS,
  noRepeatRoller,
  rollDie,
  rollMany,
  rollerFor,
  seededRoller,
} from '../src';

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

describe('the die a variant is played with', () => {
  // `rerollOnRepeat` was declared on every variant, documented, and read by
  // nothing — so `legacy-mobile` and `online` claimed to reproduce the
  // published app and rolled a fair die instead.

  it('re-rolls a repeat for the variants that ask for it', () => {
    const scripted = [6, 6, 2];
    let i = 0;
    const roller = rollerFor(LEGACY_MOBILE, () => scripted[i++]);

    expect(roller()).toBe(6);
    expect(roller()).toBe(2); // the second 6 repeated and was re-rolled
  });

  it('leaves the die alone for the variants that do not', () => {
    for (const rules of [CLASSIC, NEUROLEELA, ONCHAIN]) {
      const scripted = [6, 6, 2];
      let i = 0;
      const roller = rollerFor(rules, () => scripted[i++]);
      expect(roller(), rules.id).toBe(6);
      expect(roller(), rules.id).toBe(6); // repeat kept
    }
  });

  it('covers every variant, so none is played with the wrong die by omission', () => {
    for (const rules of Object.values(RULESETS)) {
      const roller = rollerFor(rules, seededRoller(1));
      for (let i = 0; i < 200; i++) {
        const value = roller();
        expect(value, rules.id).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(MAX_ROLL);
      }
    }
  });

  it('stays deterministic when the source is', () => {
    const first = rollMany(rollerFor(ONLINE, seededRoller(7)), 40);
    const second = rollMany(rollerFor(ONLINE, seededRoller(7)), 40);
    expect(first).toEqual(second);
  });

  it('makes a repeat rarer for the guarded variants than the fair ones', () => {
    const repeats = (values: number[]) =>
      values.filter((v, i) => i > 0 && v === values[i - 1]).length;

    const fair = rollMany(rollerFor(CLASSIC, seededRoller(5)), 20_000);
    const guarded = rollMany(rollerFor(LEGACY_MOBILE, seededRoller(5)), 20_000);
    expect(repeats(guarded)).toBeLessThan(repeats(fair) / 2);
  });
});
