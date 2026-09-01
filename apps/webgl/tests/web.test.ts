import { describe, expect, it } from 'vitest';
import { BOARD_COLUMNS, BOARD_ROWS_COUNT } from '@leela/engine';

import { sagAt, threadCount, threadsFor } from '../src/web';

/**
 * A lattice has one failure that hides completely: emit an edge twice — once
 * walking the rows, once walking the columns — and it renders identically, at
 * twice the cost, forever. The other is an open side, from missing the last row
 * or column, which reads as a design choice rather than as an error. Both are
 * counted here rather than looked at.
 */

const COLUMNS = BOARD_COLUMNS;
const ROWS = BOARD_ROWS_COUNT;

const key = (thread: { from: { column: number; row: number }; to: { column: number; row: number } }) =>
  `${thread.from.column},${thread.from.row}-${thread.to.column},${thread.to.row}`;

describe('the web', () => {
  it('draws every thread exactly once', () => {
    const threads = threadsFor(COLUMNS, ROWS);
    expect(new Set(threads.map(key)).size).toBe(threads.length);
  });

  it('draws as many threads as a lattice that size has', () => {
    const threads = threadsFor(COLUMNS, ROWS);
    expect(threads).toHaveLength(threadCount(COLUMNS, ROWS));
    // Stated independently of the generator, so the two can disagree.
    expect(threads).toHaveLength(ROWS * (COLUMNS - 1) + COLUMNS * (ROWS - 1));
  });

  it('joins only knots that are neighbours', () => {
    for (const thread of threadsFor(COLUMNS, ROWS)) {
      const across = Math.abs(thread.to.column - thread.from.column);
      const down = Math.abs(thread.to.row - thread.from.row);
      expect(across + down).toBe(1);
    }
  });

  it('reaches every knot, so the web has no loose corner', () => {
    const touched = new Set<string>();
    for (const thread of threadsFor(COLUMNS, ROWS)) {
      touched.add(`${thread.from.column},${thread.from.row}`);
      touched.add(`${thread.to.column},${thread.to.row}`);
    }
    expect(touched.size).toBe(COLUMNS * ROWS);
  });

  it('keeps every knot on the lattice', () => {
    for (const thread of threadsFor(COLUMNS, ROWS)) {
      for (const knot of [thread.from, thread.to]) {
        expect(knot.column).toBeGreaterThanOrEqual(0);
        expect(knot.column).toBeLessThan(COLUMNS);
        expect(knot.row).toBeGreaterThanOrEqual(0);
        expect(knot.row).toBeLessThan(ROWS);
      }
    }
  });

  /** The four sides, and only the four sides. */
  it('marks the rim, and marks nothing inside it as rim', () => {
    const threads = threadsFor(COLUMNS, ROWS);
    const rim = threads.filter((thread) => thread.rim);
    expect(rim).toHaveLength(2 * (COLUMNS - 1) + 2 * (ROWS - 1));
    for (const thread of rim) {
      const onEdge =
        (thread.from.row === 0 && thread.to.row === 0) ||
        (thread.from.row === ROWS - 1 && thread.to.row === ROWS - 1) ||
        (thread.from.column === 0 && thread.to.column === 0) ||
        (thread.from.column === COLUMNS - 1 && thread.to.column === COLUMNS - 1);
      expect(onEdge).toBe(true);
    }
  });

  it('refuses a lattice too small to have a thread in it', () => {
    expect(() => threadsFor(1, 5)).toThrow(RangeError);
    expect(() => threadsFor(5, 1)).toThrow(RangeError);
    expect(() => threadsFor(4.5, 5)).toThrow(RangeError);
  });
});

describe('the sag', () => {
  /** A thread that does not meet its own knot is worse than no sag at all. */
  it('is nothing at either knot', () => {
    // `toBeCloseTo`, not `toBe`: the expression yields -0 at the ends, and
    // `Object.is` separates -0 from 0 where a vertex position does not.
    expect(sagAt(0, 0.4)).toBeCloseTo(0);
    expect(sagAt(1, 0.4)).toBeCloseTo(0);
  });

  it('hangs downward, deepest in the middle', () => {
    expect(sagAt(0.5, 0.4)).toBeCloseTo(-0.4);
    for (let at = 0.05; at < 1; at += 0.05) {
      expect(sagAt(at, 0.4)).toBeLessThan(0);
      expect(sagAt(at, 0.4)).toBeGreaterThanOrEqual(sagAt(0.5, 0.4));
    }
  });

  it('is flat when nothing hangs', () => {
    for (let at = 0; at <= 1; at += 0.1) expect(sagAt(at, 0)).toBeCloseTo(0);
  });
});
