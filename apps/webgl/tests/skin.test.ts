import { describe, expect, it } from 'vitest';

import { paintScales, scales, type Brush } from '../src/skin';

/**
 * The reason this is tested rather than eyeballed: a lattice whose rows line up
 * is a brick wall, and a brick wall wrapped around a tube at the size of a
 * phone screen looks like a slightly odd tube. It would pass a glance, which is
 * the only check a texture normally gets — and the whole point of the texture
 * is to stop the snakes looking like tubes.
 */

const LATTICE = { across: 9, along: 7 };

describe('the scale lattice', () => {
  it('lays one scale per place in the lattice', () => {
    expect(scales(LATTICE)).toHaveLength(LATTICE.across * LATTICE.along);
  });

  it('keeps every scale on the tile', () => {
    for (const scale of scales(LATTICE)) {
      expect(scale.u).toBeGreaterThanOrEqual(0);
      expect(scale.u).toBeLessThan(1);
      expect(scale.v).toBeGreaterThan(0);
      expect(scale.v).toBeLessThan(1);
    }
  });

  /** The half-step. Scales interlock; rows that agree are masonry. */
  it('offsets each row by half a scale from the one before it', () => {
    const laid = scales(LATTICE);
    const rowOf = (row: number) => laid.filter((scale) => scale.row === row).map((s) => s.u).sort();
    const even = rowOf(0);
    const odd = rowOf(1);
    const step = 1 / LATTICE.across;

    for (const u of even) {
      // No scale in the odd row sits on top of one in the even row.
      const nearest = Math.min(...odd.map((other) => Math.abs(other - u)));
      expect(nearest).toBeGreaterThan(step * 0.4);
    }
  });

  it('repeats every two rows, so the tile still tiles', () => {
    const laid = scales(LATTICE);
    const rowOf = (row: number) => laid.filter((scale) => scale.row === row).map((s) => s.u).sort();
    expect(rowOf(2)).toEqual(rowOf(0));
    expect(rowOf(3)).toEqual(rowOf(1));
  });

  it('spaces the rows evenly down the tile', () => {
    const laid = scales({ across: 1, along: 4 });
    expect(laid.map((s) => s.v)).toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  it('refuses a lattice nothing can be laid on', () => {
    expect(() => scales({ across: 0, along: 4 })).toThrow(RangeError);
    expect(() => scales({ across: 4, along: 0 })).toThrow(RangeError);
    expect(() => scales({ across: 2.5, along: 4 })).toThrow(RangeError);
  });
});

describe('painting the tile', () => {
  const recorder = () => {
    const drawn: Array<{ x: number; y: number }> = [];
    const brush: Brush & { drawn: typeof drawn } = {
      drawn,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect() {},
      beginPath() {},
      ellipse(x, y) {
        drawn.push({ x, y });
      },
      fill() {},
      stroke() {},
    };
    return brush;
  };

  /**
   * A scale straddling the seam has to be painted on both edges, or every tile
   * join shows as a bald ring around the body — thirty of them, evenly spaced,
   * which reads as a defect in the model rather than in the texture.
   */
  it('paints each scale three times, so the seam carries no bald ring', () => {
    const brush = recorder();
    paintScales(brush, 256, LATTICE);
    // Filled and stroked, at three offsets, per scale.
    expect(brush.drawn).toHaveLength(LATTICE.across * LATTICE.along * 3 * 2);
  });

  it('paints one of those copies off each edge of the tile', () => {
    const brush = recorder();
    paintScales(brush, 256, { across: 1, along: 1 });
    const xs = [...new Set(brush.drawn.map((d) => d.x))].sort((a, b) => a - b);
    expect(xs).toHaveLength(3);
    expect(xs[1]! - xs[0]!).toBe(256);
    expect(xs[2]! - xs[1]!).toBe(256);
  });
});
