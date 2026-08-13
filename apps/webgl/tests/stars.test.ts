import { describe, expect, it } from 'vitest';

import { byBand, sequence, starsFor } from '../src/stars';

/**
 * A starfield has one classic defect and it does not look like a defect.
 *
 * Take the polar angle straight from a uniform number and the stars bunch at
 * the poles — several times the density they have at the equator. On screen
 * that reads as a deliberate cluster, or as the Milky Way, and nobody questions
 * it. So the evenness is measured rather than looked at.
 */

const RADIUS = 400;

describe('the sky', () => {
  it('is the same sky every time', () => {
    expect(starsFor({ count: 50, radius: RADIUS })).toEqual(starsFor({ count: 50, radius: RADIUS }));
  });

  it('is a different sky for a different seed', () => {
    const one = starsFor({ count: 50, radius: RADIUS, seed: 1 });
    const two = starsFor({ count: 50, radius: RADIUS, seed: 2 });
    expect(one).not.toEqual(two);
  });

  it('puts every star on the sphere, not inside it', () => {
    for (const star of starsFor({ count: 400, radius: RADIUS })) {
      expect(Math.hypot(star.x, star.y, star.z)).toBeCloseTo(RADIUS, 6);
    }
  });

  /**
   * The measurement. Equal-area bands hold equal shares on a uniform sphere;
   * the naive sampling loads the two polar bands with multiples of their share.
   */
  it('covers the sphere evenly, pole to pole', () => {
    const bands = byBand(starsFor({ count: 20_000, radius: RADIUS }), RADIUS, 10);
    for (const [at, share] of bands.entries()) {
      expect(share, `band ${at} holds ${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.07);
      expect(share, `band ${at} holds ${(share * 100).toFixed(1)}%`).toBeLessThan(0.13);
    }
  });

  /**
   * The same measurement, aimed at the mistake itself: a sky sampled the naive
   * way must fail the check above. A test that only passes on the good input
   * has not been shown to detect the bad one.
   */
  it('would catch the polar clustering it exists to prevent', () => {
    const next = sequence(7);
    const naive = Array.from({ length: 20_000 }, () => {
      // The wrong way: polar angle straight off a uniform number.
      const polar = next() * Math.PI;
      const around = next() * Math.PI * 2;
      return {
        x: RADIUS * Math.sin(polar) * Math.cos(around),
        y: RADIUS * Math.cos(polar),
        z: RADIUS * Math.sin(polar) * Math.sin(around),
        brightness: 1,
        size: 1,
      };
    });

    const bands = byBand(naive, RADIUS, 10);
    const polar = Math.max(bands[0] as number, bands[9] as number);
    expect(polar, 'the naive sampling did not cluster, so the check proves nothing').toBeGreaterThan(
      0.13,
    );
  });

  it('makes most stars faint and a few bright', () => {
    const stars = starsFor({ count: 5_000, radius: RADIUS });
    const bright = stars.filter((star) => star.brightness > 0.6).length / stars.length;
    expect(bright).toBeGreaterThan(0.01);
    expect(bright).toBeLessThan(0.25);
    for (const star of stars) {
      expect(star.brightness).toBeGreaterThan(0);
      expect(star.brightness).toBeLessThanOrEqual(1);
      expect(star.size).toBeGreaterThan(0);
    }
  });

  it('refuses a sky with nothing in it', () => {
    expect(() => starsFor({ count: 0, radius: RADIUS })).toThrow(RangeError);
    expect(() => starsFor({ count: 10, radius: 0 })).toThrow(RangeError);
    expect(() => starsFor({ count: 2.5, radius: RADIUS })).toThrow(RangeError);
  });
});

describe('the sequence', () => {
  it('stays inside 0..1', () => {
    const next = sequence(12345);
    for (let at = 0; at < 10_000; at += 1) {
      const drawn = next();
      expect(drawn).toBeGreaterThanOrEqual(0);
      expect(drawn).toBeLessThan(1);
    }
  });

  it('spreads evenly enough to place stars with', () => {
    const next = sequence(99);
    const buckets = new Array<number>(10).fill(0);
    for (let at = 0; at < 100_000; at += 1) {
      const bucket = Math.min(9, Math.floor(next() * 10));
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) expect(count / 100_000).toBeCloseTo(0.1, 2);
  });
});
