import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  BOARD_COLUMNS,
  BOARD_ROWS,
  BOARD_ROWS_COUNT,
  SNAKES,
  TOTAL_PLANS,
  WIN_LOKA,
  boardPosition,
  isOnBoard,
} from '../src';

describe('board topology', () => {
  it('keeps every snake on the board and pointing down', () => {
    for (const [head, tail] of Object.entries(SNAKES)) {
      expect(isOnBoard(Number(head)), `snake head ${head}`).toBe(true);
      expect(isOnBoard(tail), `snake tail ${tail}`).toBe(true);
      expect(tail, `snake ${head} must descend`).toBeLessThan(Number(head));
    }
  });

  it('keeps every arrow on the board and pointing up', () => {
    for (const [tail, head] of Object.entries(ARROWS)) {
      expect(isOnBoard(Number(tail)), `arrow tail ${tail}`).toBe(true);
      expect(isOnBoard(head), `arrow head ${head}`).toBe(true);
      expect(head, `arrow ${tail} must ascend`).toBeGreaterThan(Number(tail));
    }
  });

  it('never puts a snake and an arrow on the same square', () => {
    const overlap = Object.keys(SNAKES).filter((k) => k in ARROWS);
    expect(overlap).toEqual([]);
  });

  it('never chains one jump straight into another', () => {
    for (const tail of Object.values(SNAKES)) {
      expect(tail in SNAKES || tail in ARROWS, `snake lands on a jump at ${tail}`).toBe(false);
    }
    for (const head of Object.values(ARROWS)) {
      expect(head in SNAKES || head in ARROWS, `arrow lands on a jump at ${head}`).toBe(false);
    }
  });

  it('leaves the win square free of jumps so it can only be reached by landing', () => {
    expect(WIN_LOKA in SNAKES).toBe(false);
    expect(WIN_LOKA in ARROWS).toBe(false);
  });

  it('lays out every plan exactly once, in eight rows of nine', () => {
    expect(BOARD_ROWS).toHaveLength(BOARD_ROWS_COUNT);
    for (const row of BOARD_ROWS) expect(row).toHaveLength(BOARD_COLUMNS);

    const flat = BOARD_ROWS.flat();
    expect(flat).toHaveLength(TOTAL_PLANS);
    expect([...flat].sort((a, b) => a - b)).toEqual(
      Array.from({ length: TOTAL_PLANS }, (_, i) => i + 1),
    );
  });

  it('runs bottom to top, alternating direction like the physical board', () => {
    const bottom = BOARD_ROWS[BOARD_ROWS_COUNT - 1];
    expect(bottom[0]).toBe(1);
    expect(bottom[BOARD_COLUMNS - 1]).toBe(9);

    // The next row up continues from 10, running the other way.
    const second = BOARD_ROWS[BOARD_ROWS_COUNT - 2];
    expect(second[BOARD_COLUMNS - 1]).toBe(10);
    expect(second[0]).toBe(18);

    // 72 finishes in the top-left corner.
    expect(BOARD_ROWS[0][0]).toBe(TOTAL_PLANS);
  });

  it('keeps consecutive plans adjacent, which is what makes a walk a walk', () => {
    for (let plan = 1; plan < TOTAL_PLANS; plan++) {
      const here = boardPosition(plan);
      const next = boardPosition(plan + 1);
      const distance =
        Math.abs(here.row - next.row) + Math.abs(here.column - next.column);
      expect(distance, `${plan} -> ${plan + 1}`).toBe(1);
    }
  });

  it('finds every plan, and refuses one that is not there', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const { row, column } = boardPosition(plan);
      expect(BOARD_ROWS[row][column]).toBe(plan);
    }
    expect(() => boardPosition(0)).toThrow(RangeError);
    expect(() => boardPosition(73)).toThrow(RangeError);
  });

  it('puts the win square where the published board has it', () => {
    // 68 sits in the top row, which is why an overshoot has nowhere to go.
    expect(boardPosition(WIN_LOKA).row).toBe(0);
  });

  it('counts 10 snakes and 10 arrows on a 72 square board', () => {
    expect(Object.keys(SNAKES)).toHaveLength(10);
    expect(Object.keys(ARROWS)).toHaveLength(10);
    expect(TOTAL_PLANS).toBe(72);
  });
});

describe('an index that can miss', () => {
  /**
   * `noUncheckedIndexedAccess` is on for what ships, and these are the two
   * places in the engine where the answer to "what if it misses" changed from
   * a type assertion to a decision.
   */
  it('finds every plan, and refuses everything else', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan += 1) {
      const { row, column } = boardPosition(plan);
      expect(BOARD_ROWS[row]?.[column]).toBe(plan);
    }
    for (const off of [0, TOTAL_PLANS + 1, -1, 1.5, NaN]) {
      expect(() => boardPosition(off), String(off)).toThrow(RangeError);
    }
  });
});
