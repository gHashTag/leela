import { describe, expect, it } from 'vitest';
import { ARROWS, SNAKES, TOTAL_PLANS, WIN_LOKA, isOnBoard } from '../src';

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

  it('counts 10 snakes and 10 arrows on a 72 square board', () => {
    expect(Object.keys(SNAKES)).toHaveLength(10);
    expect(Object.keys(ARROWS)).toHaveLength(10);
    expect(TOTAL_PLANS).toBe(72);
  });
});
