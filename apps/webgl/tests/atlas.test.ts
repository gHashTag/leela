import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS } from '@leela/engine';

import { gridFor, paintLabels, patchFor, tileFor, TileOutOfRangeError, type Painter } from '../src/atlas';
import { plans } from '../src/layout';

/**
 * A tile off by one row paints every square with its neighbour's number, and
 * the board still looks like a board. So the mapping is checked exhaustively —
 * all seventy-two, both directions — rather than at three sample points.
 */

const GRID = gridFor(TOTAL_PLANS);

describe('the atlas grid', () => {
  it('holds every plan', () => {
    expect(GRID.columns * GRID.rows).toBeGreaterThanOrEqual(TOTAL_PLANS);
  });

  it('is as square as it can be, so no tile has to shrink to fit a texture', () => {
    expect(Math.abs(GRID.columns - GRID.rows)).toBeLessThanOrEqual(1);
  });

  it('refuses a count nothing can be laid out for', () => {
    expect(() => gridFor(0)).toThrow(RangeError);
    expect(() => gridFor(-3)).toThrow(RangeError);
    expect(() => gridFor(2.5)).toThrow(RangeError);
  });
});

describe('where a tile is', () => {
  it('gives every plan its own patch of canvas, with none overlapping', () => {
    const seen = new Set<string>();
    for (let at = 0; at < TOTAL_PLANS; at += 1) {
      const patch = patchFor(at, GRID, 128);
      const key = `${patch.x},${patch.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(TOTAL_PLANS);
  });

  it('gives every plan its own rectangle of texture, with none overlapping', () => {
    const seen = new Set<string>();
    for (let at = 0; at < TOTAL_PLANS; at += 1) {
      const tile = tileFor(at, GRID);
      seen.add(`${tile.u0},${tile.v0}`);
      expect(tile.u1).toBeGreaterThan(tile.u0);
      expect(tile.v1).toBeGreaterThan(tile.v0);
    }
    expect(seen.size).toBe(TOTAL_PLANS);
  });

  it('stays inside the texture for every plan', () => {
    for (let at = 0; at < TOTAL_PLANS; at += 1) {
      const tile = tileFor(at, GRID);
      expect(tile.u0).toBeGreaterThanOrEqual(0);
      expect(tile.v0).toBeGreaterThanOrEqual(0);
      expect(tile.u1).toBeLessThanOrEqual(1);
      expect(tile.v1).toBeLessThanOrEqual(1);
    }
  });

  /**
   * The flip is the defect this file exists for. A canvas is drawn top-down and
   * a texture is sampled bottom-up, so tile 0 — painted in the canvas's
   * top-left — must be the *top* row in UV. Reading it upside down does not
   * look upside down; it looks like every square carrying the wrong number.
   */
  it('puts the first tile at the top of the texture, matching the canvas', () => {
    const first = tileFor(0, GRID);
    expect(first.v1).toBeCloseTo(1);
    expect(first.u0).toBeCloseTo(0);
  });

  it('runs down the texture in the same order it runs down the canvas', () => {
    const firstOfRowTwo = tileFor(GRID.columns, GRID);
    const firstOfRowOne = tileFor(0, GRID);
    expect(patchFor(GRID.columns, GRID, 128).y).toBeGreaterThan(patchFor(0, GRID, 128).y);
    expect(firstOfRowTwo.v1).toBeLessThan(firstOfRowOne.v1);
  });

  it('refuses a tile that is not on the sheet', () => {
    expect(() => tileFor(-1, GRID)).toThrow(TileOutOfRangeError);
    expect(() => tileFor(GRID.columns * GRID.rows, GRID)).toThrow(TileOutOfRangeError);
    expect(() => patchFor(1.5, GRID, 128)).toThrow(TileOutOfRangeError);
  });
});

describe('painting the labels', () => {
  const recorder = (): Painter & { drawn: Array<{ text: string; x: number; y: number }> } => ({
    drawn: [],
    clearRect() {},
    fillText(text, x, y) {
      this.drawn.push({ text, x, y });
    },
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  });

  it('paints one label per plan, and paints all of them', () => {
    const painter = recorder();
    paintLabels(painter, plans().map(String), 128, { colour: '#000' });
    expect(painter.drawn).toHaveLength(TOTAL_PLANS);
    expect(painter.drawn.map((d) => d.text)).toEqual(plans().map(String));
  });

  it('centres each label in its own tile', () => {
    const painter = recorder();
    paintLabels(painter, plans().map(String), 100, { colour: '#000' });
    for (const [at, drawn] of painter.drawn.entries()) {
      const patch = patchFor(at, GRID, 100);
      expect(drawn.x).toBeCloseTo(patch.x + 50);
      expect(drawn.y).toBeCloseTo(patch.y + 50);
    }
  });

  it('centres the text, or a two-digit number sits off its own square', () => {
    const painter = recorder();
    paintLabels(painter, ['1'], 128, { colour: '#000' });
    expect(painter.textAlign).toBe('center');
    expect(painter.textBaseline).toBe('middle');
  });
});
