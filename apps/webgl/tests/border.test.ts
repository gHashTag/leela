import { describe, expect, it } from 'vitest';

import { fitCount, paintBorder, runAlong, type Edger } from '../src/border';

/**
 * The one property worth holding: a **whole number** of motifs on every edge.
 * A border whose last repeat is clipped by the corner is the clearest tell of a
 * pattern applied rather than drawn, and it is invisible in code — the
 * arithmetic reads correctly, and the seam only appears in the corner of a
 * render nobody zoomed into.
 */

describe('fitting a run of motifs', () => {
  it('always fits a whole number of them', () => {
    for (let span = 1; span < 400; span += 7) {
      const count = fitCount(span, 23);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * An edge shorter than one motif still gets one. An edge with nothing on it
   * beside three edges with something is worse than a motif slightly the wrong
   * size.
   */
  it('puts one on an edge too short for one', () => {
    expect(fitCount(4, 40)).toBe(1);
    expect(runAlong(4, 40).at).toHaveLength(1);
  });

  it('keeps the pitch close to what was asked for', () => {
    for (let span = 40; span < 400; span += 13) {
      const { pitch } = runAlong(span, 23);
      expect(pitch).toBeGreaterThan(23 / 1.6);
      expect(pitch).toBeLessThan(23 * 1.6);
    }
  });

  it('spaces them evenly', () => {
    const { at, pitch } = runAlong(300, 23);
    const gaps = at.slice(1).map((value, index) => value - (at[index] as number));
    for (const gap of gaps) expect(gap).toBeCloseTo(pitch);
  });

  /**
   * Symmetric within the span, so two runs meeting at a corner leave the same
   * gap on both sides of it. Without this the four corners disagree and the
   * border looks hand-placed.
   */
  it('leaves the same gap at both ends', () => {
    const span = 300;
    const { at } = runAlong(span, 23);
    expect(at[0]).toBeCloseTo(span - (at.at(-1) as number));
  });

  it('never puts a motif outside its edge', () => {
    for (let span = 5; span < 300; span += 11) {
      for (const value of runAlong(span, 23).at) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(span);
      }
    }
  });

  it('refuses a span or a motif that is not a size', () => {
    expect(() => fitCount(0, 20)).toThrow(RangeError);
    expect(() => fitCount(-5, 20)).toThrow(RangeError);
    expect(() => fitCount(100, 0)).toThrow(RangeError);
    expect(() => runAlong(100, -1)).toThrow(RangeError);
  });
});

describe('painting the face', () => {
  const recorder = () => {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const outlines: Array<{ x: number; y: number; w: number; h: number }> = [];
    const paths: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];

    const edger: Edger & { rects: typeof rects; outlines: typeof outlines; paths: typeof paths } = {
      rects,
      outlines,
      paths,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect(x, y, w, h) {
        rects.push({ x, y, w, h });
      },
      strokeRect(x, y, w, h) {
        outlines.push({ x, y, w, h });
      },
      beginPath() {
        current = [];
      },
      moveTo(x, y) {
        current.push({ x, y });
      },
      lineTo(x, y) {
        current.push({ x, y });
      },
      closePath() {},
      fill() {
        paths.push(current);
      },
    };
    return edger;
  };

  /** `map` multiplies `color`, and the face is painted rather than filled — so
      the ground has to cover the whole texture or the slab shows through. */
  it('covers the whole face before drawing anything on it', () => {
    const edger = recorder();
    paintBorder(edger, 1024, 909, { ground: '#fff', ink: '#000' });
    expect(edger.rects[0]).toEqual({ x: 0, y: 0, w: 1024, h: 909 });
  });

  it('rules the margin twice, both inside the face', () => {
    const edger = recorder();
    paintBorder(edger, 1024, 909, { ground: '#fff', ink: '#000' });
    expect(edger.outlines).toHaveLength(2);
    for (const rule of edger.outlines) {
      expect(rule.x).toBeGreaterThan(0);
      expect(rule.y).toBeGreaterThan(0);
      expect(rule.x + rule.w).toBeLessThan(1024);
      expect(rule.y + rule.h).toBeLessThan(909);
    }
  });

  it('draws every motif as a closed four-sided diamond', () => {
    const edger = recorder();
    paintBorder(edger, 1024, 909, { ground: '#fff', ink: '#000' });
    expect(edger.paths.length).toBeGreaterThan(8);
    for (const path of edger.paths) expect(path).toHaveLength(4);
  });

  /** Four corners, or the runs stop in the air where they meet. */
  it('lands a motif on each of the four corners', () => {
    const edger = recorder();
    paintBorder(edger, 1024, 909, { ground: '#fff', ink: '#000' });
    const centres = edger.paths.map((path) => ({
      x: (path[1] as { x: number }).x - ((path[1] as { x: number }).x - (path[3] as { x: number }).x) / 2,
      y: (path[2] as { y: number }).y - ((path[2] as { y: number }).y - (path[0] as { y: number }).y) / 2,
    }));
    const band = Math.min(1024, 909) * 0.052 * 0.66;
    for (const [cx, cy] of [
      [band, band],
      [1024 - band, band],
      [band, 909 - band],
      [1024 - band, 909 - band],
    ]) {
      expect(
        centres.some((c) => Math.abs(c.x - cx) < 0.5 && Math.abs(c.y - cy) < 0.5),
        `no motif at ${cx},${cy}`,
      ).toBe(true);
    }
  });

  it('keeps every motif inside the face', () => {
    const edger = recorder();
    paintBorder(edger, 1024, 909, { ground: '#fff', ink: '#000' });
    for (const path of edger.paths) {
      for (const point of path) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1024);
        expect(point.y).toBeLessThanOrEqual(909);
      }
    }
  });
});
