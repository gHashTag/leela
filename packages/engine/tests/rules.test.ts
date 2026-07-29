import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  SNAKES,
  START_LOKA,
  TOTAL_PLANS,
  WIN_LOKA,
  getDirectionAndPosition,
  handleConsecutiveSixes,
  validatePosition,
} from '../src';

describe('handleConsecutiveSixes', () => {
  it('resets the run and advances normally when the roll is not a six', () => {
    const r = handleConsecutiveSixes(3, 10, 2, 5);
    expect(r).toEqual({ newConsecutive: 0, newPosition: 13, newBeforeThreeSixes: 5 });
  });

  it('remembers the starting square on the first six', () => {
    const r = handleConsecutiveSixes(6, 10, 0, 0);
    expect(r).toEqual({ newConsecutive: 1, newPosition: 16, newBeforeThreeSixes: 10 });
  });

  it('keeps the remembered square on the second six', () => {
    const r = handleConsecutiveSixes(6, 16, 1, 10);
    expect(r).toEqual({ newConsecutive: 2, newPosition: 22, newBeforeThreeSixes: 10 });
  });

  it('sends the player back and clears the run on the third six', () => {
    const r = handleConsecutiveSixes(6, 22, 2, 10);
    expect(r.newConsecutive).toBe(0);
    expect(r.newPosition).toBe(10);
    expect(r.newBeforeThreeSixes).toBe(10);
    expect(r.direction).toBe('snake 🐍');
  });

  it('starts a fresh run after a reset', () => {
    const r = handleConsecutiveSixes(6, 10, 0, 10);
    expect(r.newConsecutive).toBe(1);
    expect(r.newBeforeThreeSixes).toBe(10);
  });
});

describe('getDirectionAndPosition', () => {
  it('lets a six start the game from the win square', () => {
    const r = getDirectionAndPosition(74, true, 6, WIN_LOKA);
    expect(r).toEqual({ finalLoka: START_LOKA, direction: 'step 🚶🏼', isGameFinished: false });
  });

  it('keeps a waiting player in place on anything but a six', () => {
    for (const roll of [1, 2, 3, 4, 5]) {
      const r = getDirectionAndPosition(WIN_LOKA + roll, true, roll, WIN_LOKA);
      expect(r).toEqual({ finalLoka: WIN_LOKA, direction: 'stop 🛑', isGameFinished: true });
    }
  });

  it('wins on an exact landing at 68', () => {
    const r = getDirectionAndPosition(WIN_LOKA, false, 3, 65);
    expect(r).toEqual({ finalLoka: WIN_LOKA, direction: 'win 🕉', isGameFinished: true });
  });

  it('refuses a roll that would overshoot the board', () => {
    const r = getDirectionAndPosition(TOTAL_PLANS + 1, false, 5, 70);
    expect(r).toEqual({ finalLoka: 70, direction: 'stop 🛑', isGameFinished: false });
  });

  it('allows the last square, 72, which carries a snake', () => {
    const r = getDirectionAndPosition(72, false, 2, 70);
    expect(r).toEqual({ finalLoka: 51, direction: 'snake 🐍', isGameFinished: false });
  });

  it('applies every snake', () => {
    for (const [head, tail] of Object.entries(SNAKES)) {
      const r = getDirectionAndPosition(Number(head), false, 1, Number(head) - 1);
      expect(r.finalLoka, `snake ${head}`).toBe(tail);
      expect(r.direction).toBe('snake 🐍');
      expect(r.isGameFinished).toBe(false);
    }
  });

  it('applies every arrow', () => {
    for (const [tail, head] of Object.entries(ARROWS)) {
      const r = getDirectionAndPosition(Number(tail), false, 1, Number(tail) - 1);
      expect(r.finalLoka, `arrow ${tail}`).toBe(head);
      expect(r.direction).toBe('arrow 🏹');
    }
  });

  it('wins through the arrow at 54', () => {
    const r = getDirectionAndPosition(54, false, 1, 53);
    expect(r).toEqual({ finalLoka: WIN_LOKA, direction: 'arrow 🏹', isGameFinished: true });
  });

  it('takes a plain step when nothing special applies', () => {
    const r = getDirectionAndPosition(15, false, 4, 11);
    expect(r).toEqual({ finalLoka: 15, direction: 'step 🚶🏼', isGameFinished: false });
  });
});

describe('validatePosition', () => {
  it('accepts the whole board and rejects everything else', () => {
    expect(validatePosition(1)).toBe(true);
    expect(validatePosition(TOTAL_PLANS)).toBe(true);
    expect(validatePosition(0)).toBe(false);
    expect(validatePosition(TOTAL_PLANS + 1)).toBe(false);
  });
});
