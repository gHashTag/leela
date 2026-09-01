import { describe, expect, it } from 'vitest';

import { holdsTheDie, owedFor } from '../src/owed';

/**
 * The gate is the one place in this app where being wrong in the closed
 * direction produces a player who cannot play at all, so both directions are
 * checked rather than only the interesting one.
 */

describe('before anyone is on the board', () => {
  it('asks for nothing, because there is no square to write about', () => {
    expect(owedFor({ plan: null, written: 0 })).toEqual({
      owes: false,
      why: 'not-on-the-board',
    });
  });

  it('leaves the die open, or the game could never start', () => {
    expect(holdsTheDie({ plan: null, written: 0 })).toBe(false);
  });
});

describe('standing on a square nothing has been written about', () => {
  it('owes a reflection, and names the square', () => {
    expect(owedFor({ plan: 23, written: 0 })).toEqual({ owes: true, plan: 23 });
  });

  it('closes the die', () => {
    expect(holdsTheDie({ plan: 23, written: 0 })).toBe(true);
  });

  it('owes on plan 1 as much as on plan 68', () => {
    for (const plan of [1, 6, 34, 68, 72]) {
      expect(holdsTheDie({ plan, written: 0 })).toBe(true);
    }
  });
});

describe('once something is written', () => {
  it('opens the die', () => {
    expect(holdsTheDie({ plan: 23, written: 1 })).toBe(false);
  });

  it('does not ask twice for the same landing', () => {
    expect(owedFor({ plan: 23, written: 1 })).toEqual({
      owes: false,
      why: 'already-written',
    });
    expect(owedFor({ plan: 23, written: 9 })).toEqual({
      owes: false,
      why: 'already-written',
    });
  });
});

describe('the gate and the reason agree', () => {
  /**
   * Two readings of one rule drift apart, and the drift shows up as a die the
   * player cannot press with nothing on screen explaining why.
   */
  it.each([
    [{ plan: null, written: 0 }],
    [{ plan: null, written: 3 }],
    [{ plan: 6, written: 0 }],
    [{ plan: 6, written: 1 }],
    [{ plan: 72, written: 0 }],
    [{ plan: 72, written: 2 }],
  ])('%o', (standing) => {
    expect(holdsTheDie(standing)).toBe(owedFor(standing).owes);
  });
});

/**
 * The contradiction this rule was shipped with, and the reason it is here.
 *
 * A six earns another throw, and the screen says so. Gating between the throws
 * of that chain put two instructions on screen at once — roll again, and write
 * first — with the die obeying the second. The player follows the sentence,
 * presses, nothing happens, and reports that the moves do not work.
 */
describe('while a six is still moving', () => {
  it('does not ask, however new the square is', () => {
    expect(owedFor({ plan: 6, written: 0, rollsAgain: true })).toEqual({
      owes: false,
      why: 'still-moving',
    });
  });

  it('leaves the die open, because the sentence says to throw again', () => {
    expect(holdsTheDie({ plan: 6, written: 0, rollsAgain: true })).toBe(false);
  });

  it('asks as soon as the chain ends', () => {
    expect(holdsTheDie({ plan: 6, written: 0, rollsAgain: false })).toBe(true);
    // Absent means the same as false: a turn that said nothing about it is over.
    expect(holdsTheDie({ plan: 6, written: 0 })).toBe(true);
  });
});
