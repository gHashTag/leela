import { describe, expect, it } from 'vitest';

import { FREE_THROWS, isLastFree, movesTaken, throwsTaken, tollFor } from '../src/toll';

/**
 * Three successful moves free, then the game asks.
 *
 * The rule lives in one function because it would otherwise be written twice —
 * once where the die is disabled and once where the message is chosen — and the
 * two drift the first time the number changes.
 */

const inApp = (taken: number, entitled = false) => ({ taken, entitled, hosted: true });

describe('what the free allowance counts', () => {
  it('does not charge for a throw that failed to open the game', () => {
    // Entry costs a six. Three throws of anything else leave the player exactly
    // where they started - off the board, having seen nothing - and this used to
    // spend the whole allowance. `(5/6)^3 = 57.9%` of new players would have met
    // the paywall without once standing on a plane.
    expect(movesTaken([[1, 2, 3]])).toBe(0);
    expect(movesTaken([[5, 4, 5, 2, 3]])).toBe(0);
    expect(tollFor(inApp(movesTaken([[1, 2, 3]])))).toEqual({ mayThrow: true, left: 3 });
  });

  it('charges for the six that puts you on the board, and for what follows', () => {
    // The six is a move: it takes the player from nowhere to plane 6.
    expect(movesTaken([[6]])).toBe(1);
    // Six to enter, then a five that walks to 11. Two moves.
    expect(movesTaken([[6, 5]])).toBe(2);
    // The failures in between cost nothing.
    expect(movesTaken([[2, 4, 6, 5]])).toBe(2);
  });

  it('gives every player three moves however unlucky the die was', () => {
    // The promise the screen makes - "your first three moves are free" - is now
    // one the game keeps for everybody rather than for the 42% who rolled a six.
    const unlucky = [3, 1, 4, 2, 5, 5, 2, 1, 6];
    expect(movesTaken([unlucky])).toBe(1);
    expect(tollFor(inApp(movesTaken([unlucky]))).mayThrow).toBe(true);
  });

  it('still counts every throw when asked how many there were', () => {
    // The history panel asks a different question and gets the old answer.
    expect(throwsTaken([[2, 4, 6, 5]])).toBe(4);
    expect(movesTaken([[2, 4, 6, 5]])).toBe(2);
  });

  it('adds up across seats', () => {
    expect(movesTaken([[6, 5], [1, 2]])).toBe(2);
  });
});

describe('the first three moves', () => {
  it('are free, and say how many are left', () => {
    expect(tollFor(inApp(0))).toEqual({ mayThrow: true, left: 3 });
    expect(tollFor(inApp(1))).toEqual({ mayThrow: true, left: 2 });
    expect(tollFor(inApp(2))).toEqual({ mayThrow: true, left: 1 });
  });

  it('run out on the fourth', () => {
    expect(tollFor(inApp(3))).toEqual({ mayThrow: false, left: 0 });
    expect(tollFor(inApp(9))).toEqual({ mayThrow: false, left: 0 });
  });

  it('are as many as the constant says', () => {
    // Stated against the constant rather than against `3`, so the test is
    // about the rule and not about today's number.
    expect(tollFor(inApp(FREE_THROWS - 1)).mayThrow).toBe(true);
    expect(tollFor(inApp(FREE_THROWS)).mayThrow).toBe(false);
  });
});

describe('who is never asked', () => {
  it('a player who holds a subscription', () => {
    expect(tollFor(inApp(50, true))).toEqual({ mayThrow: true, left: null });
  });

  it('anybody the page cannot ask', () => {
    // A browser, a preview, a screenshot: no store, no receipt, no way to pay.
    // A toll there is a game that stops and cannot be started again.
    expect(tollFor({ taken: 99, entitled: false, hosted: false })).toEqual({
      mayThrow: true,
      left: null,
    });
  });

  it('and `left` is null for them, not zero', () => {
    // Null is "never asked"; zero is "asked now". A screen that reads them
    // alike tells a browser it has run out of free moves.
    expect(tollFor(inApp(3)).left).toBe(0);
    expect(tollFor(inApp(3, true)).left).toBeNull();
  });
});

describe('the warning', () => {
  it('comes on the last free move, not after it', () => {
    // Before the die stops rather than after: saying it every throw is nagging,
    // saying it once the die has stopped is a surprise.
    expect(isLastFree(tollFor(inApp(2)))).toBe(true);
    expect(isLastFree(tollFor(inApp(1)))).toBe(false);
    expect(isLastFree(tollFor(inApp(3)))).toBe(false);
    expect(isLastFree(tollFor(inApp(0, true)))).toBe(false);
  });
});

describe('counting the throws', () => {
  it('counts every seat, because the die is shared', () => {
    expect(throwsTaken([[6, 2], [4]])).toBe(3);
  });

  it('is nothing on a table nobody has thrown at', () => {
    expect(throwsTaken([])).toBe(0);
    expect(throwsTaken([[]])).toBe(0);
  });

  it('is read from the record, so a reload does not refill it', () => {
    // A count kept in a variable is lost on reload, and reloading is how
    // somebody would get their three throws back for ever. The saved table is
    // the only thing that survives, so it is the only thing worth counting.
    const saved = [[1, 2, 3, 4]];
    expect(throwsTaken(saved)).toBe(4);
    expect(tollFor({ taken: throwsTaken(saved), entitled: false, hosted: true }).mayThrow).toBe(
      false,
    );
  });
});
