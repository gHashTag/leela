import { describe, expect, it } from 'vitest';
import { MAX_ROLL } from '@leela/engine';
import { MAX_FACE, MIN_FACE, faceFor, spinDegrees, spinMs, type DieFaces } from '../src/die';

/**
 * The die the published app throws.
 *
 * `components/Dice/index.tsx` is a pressable image: you tap the die, it spins,
 * and it settles on the face you threw. The mini app had a button reading
 * "Roll" — the player was told what they threw in a sentence and never saw it.
 *
 * Two things are worth keeping out of the DOM and are asserted here: that the
 * die always shows something, and that the spin is a function of the value the
 * way the original makes it one.
 */

const FACES: DieFaces = ['/1', '/2', '/3', '/4', '/5', '/6'];

describe('the face', () => {
  it('is the one thrown, for every value the die can show', () => {
    for (let value = MIN_FACE; value <= MAX_FACE; value += 1) {
      expect(faceFor(value, FACES)).toBe(`/${value}`);
    }
  });

  it('covers everything the engine can roll', () => {
    // Not a coincidence worth relying on silently: the die has as many faces
    // as the engine has values, and a seventh value would have nowhere to go.
    expect(MAX_FACE).toBe(MAX_ROLL);
  });

  it('is never nothing, whatever it is asked for', () => {
    // A blank square where the die was reads as a broken app rather than as a
    // throw that failed.
    for (const value of [0, 7, -1, 99, 2.7, NaN, Infinity, -Infinity]) {
      const face = faceFor(value, FACES);
      expect(FACES, String(value)).toContain(face);
    }
  });

  it('truncates rather than rounds, so 2.9 is a two', () => {
    expect(faceFor(2.9, FACES)).toBe('/2');
  });
});

describe('the spin', () => {
  it('is the original formula: value over two, times five hundred', () => {
    for (let value = MIN_FACE; value <= MAX_FACE; value += 1) {
      expect(spinMs(value)).toBe((value / 2) * 500);
      expect(spinDegrees(value)).toBe(value * 360);
    }
  });

  it('makes a six feel like a six', () => {
    // The property, rather than the six numbers: a larger throw takes longer
    // and turns further, which is the whole reason the duration is tied to the
    // value instead of being a constant.
    for (let value = MIN_FACE; value < MAX_FACE; value += 1) {
      expect(spinMs(value + 1)).toBeGreaterThan(spinMs(value));
      expect(spinDegrees(value + 1)).toBeGreaterThan(spinDegrees(value));
    }
  });

  it('always finishes, whatever it is handed', () => {
    // An animation of NaN milliseconds never ends, and the die would stay
    // disabled with the game waiting behind it.
    for (const value of [0, -1, 99, NaN, Infinity, -Infinity, 2.5]) {
      const ms = spinMs(value);
      expect(Number.isFinite(ms), String(value)).toBe(true);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(spinMs(MAX_FACE));

      const degrees = spinDegrees(value);
      expect(Number.isFinite(degrees), String(value)).toBe(true);
      expect(degrees).toBeGreaterThan(0);
    }
  });
});
