import { describe, expect, it } from 'vitest';
import {
  AA_LARGE,
  AA_TEXT,
  DARK,
  LIGHT,
  channels,
  contrast,
  luminance,
  measurePalette,
} from '../src/contrast';

describe('the palette meets contrast in both themes', () => {
  // The originals — #c2452d, #2f8f4e, #b08422 — measured 4.50, 3.64 and 3.05
  // on the light surface and 3.46, 4.27, 5.11 on the dark one. Not one passed
  // in both, which is what a single palette for two backgrounds produces. The
  // red rounds to 4.50 and is a hair under it, which is its own lesson about
  // eyeballing a number that has a threshold.

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ])('%s: every mark clears 4.5:1 against its own surface', (_name, palette) => {
    for (const { name, ratio } of measurePalette(palette)) {
      expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('would have failed on the colours that shipped', () => {
    // The check has to be capable of failing, or it proves nothing.
    const original = { surface: '#f2f2f6', snake: '#c2452d', arrow: '#2f8f4e', win: '#b08422' };
    const failures = measurePalette(original).filter(({ ratio }) => ratio < AA_TEXT);
    // All three, including the red that displays as 4.50 when rounded.
    expect(failures.map((f) => f.name)).toEqual(['snake', 'arrow', 'win']);
  });

  it('uses a different palette per theme, rather than one for both', () => {
    for (const key of ['snake', 'arrow', 'win'] as const) {
      expect(LIGHT[key], key).not.toBe(DARK[key]);
    }
  });

  it('keeps the light marks dark and the dark marks light', () => {
    // A hue lifted for a dark surface must actually be lighter than its
    // counterpart, or it is a different colour rather than the same one.
    for (const key of ['snake', 'arrow', 'win'] as const) {
      expect(luminance(DARK[key]), key).toBeGreaterThan(luminance(LIGHT[key]));
    }
  });
});

describe('contrast', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#3a7bd5', '#3a7bd5')).toBeCloseTo(1, 5);
  });

  it('does not depend on the order of its arguments', () => {
    expect(contrast('#123456', '#abcdef')).toBeCloseTo(contrast('#abcdef', '#123456'), 10);
  });

  it('never falls outside 1 to 21', () => {
    const colours = ['#000', '#fff', '#f08a72', '#1f6b39', '#7a5a12', '#1a1a1c'];
    for (const a of colours) {
      for (const b of colours) {
        const ratio = contrast(a, b);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }
    }
  });

  it('agrees with the published value for a known pair', () => {
    // #767676 on white is the canonical 4.54:1 example.
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });
});

describe('channels', () => {
  it('accepts both three and six digit hex, with or without the hash', () => {
    expect(channels('#fff')).toEqual([1, 1, 1]);
    expect(channels('ffffff')).toEqual([1, 1, 1]);
    expect(channels('#000000')).toEqual([0, 0, 0]);
  });

  it('refuses anything that is not a hex colour', () => {
    for (const bad of ['', '#gg0000', 'rgb(1,2,3)', '#12345']) {
      expect(() => channels(bad), bad).toThrow(RangeError);
    }
  });
});

describe('the thresholds', () => {
  it('are the WCAG values, not something convenient', () => {
    expect(AA_TEXT).toBe(4.5);
    expect(AA_LARGE).toBe(3);
  });
});
