import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  MAX_ROLL,
  TOTAL_PLANS,
  WIN_LOKA,
  applyRoll,
  hasWon,
  initialState,
  seededRoller,
  type GameState,
} from '@leela/engine';
import { headline } from '../src/view';

/**
 * The win was erased at the moment it happened.
 *
 * `draw()` asked `state.is_finished` to mean "waiting to enter". A player who
 * has won is also finished, so arriving on 68 reset the header to "—", set the
 * progress bar to zero and took the token off the board — while the sentence
 * underneath said they had reached Cosmic Consciousness.
 *
 * 68 means two things depending on how you got there, and `hasWon` is the
 * engine's answer to that. This was the fourth place to be caught by it.
 */

const titleOf = (plan: number) => `Plan ${plan}`;

/** Play until the state satisfies a condition, or give up loudly. */
function playUntil(matches: (state: GameState) => boolean, seed = 1): GameState {
  const die = seededRoller(seed);
  let state = initialState();
  for (let round = 0; round < 4000; round += 1) {
    state = applyRoll(state, die(), CLASSIC).state;
    if (matches(state)) return state;
  }
  throw new Error('never reached that state');
}

describe('a player who has won', () => {
  const won = playUntil(hasWon);

  it('is shown on the square they reached, not taken off the board', () => {
    const show = headline(won, 'en', titleOf);
    expect(show.here).toBe(WIN_LOKA);
    expect(show.number).toBe(String(WIN_LOKA));
  });

  it('sees the bar full rather than reset', () => {
    expect(headline(won, 'en', titleOf).progress).toBe(WIN_LOKA);
  });

  it('is not told to throw a six to enter the game they have just finished', () => {
    const show = headline(won, 'en', titleOf);
    expect(show.waiting).toBe(false);
    expect(show.title).toBe(titleOf(WIN_LOKA));
  });

  it('can still read the plan they arrived on', () => {
    expect(headline(won, 'en', titleOf).canRead).toBe(true);
  });
});

describe('a player who has not entered yet', () => {
  const fresh = initialState();

  it('is off the board, with nothing to read', () => {
    const show = headline(fresh, 'en', titleOf);
    expect(show.here).toBeNull();
    expect(show.from).toBeNull();
    expect(show.number).toBe('—');
    expect(show.progress).toBe(0);
    expect(show.canRead).toBe(false);
    expect(show.waiting).toBe(true);
  });

  it('is told what would let them in, in their own language', () => {
    expect(headline(fresh, 'ru', titleOf).title).toMatch(/шестёрку/);
  });

  it('stays that way after a throw that is not a six', () => {
    for (let roll = 1; roll < MAX_ROLL; roll += 1) {
      const after = applyRoll(fresh, roll, CLASSIC).state;
      expect(headline(after, 'en', titleOf).waiting, `after ${roll}`).toBe(true);
    }
  });
});

describe('across every state a real game reaches', () => {
  /** Every state from several deterministic games, deduplicated by shape. */
  function states(): GameState[] {
    const seen: GameState[] = [initialState()];
    for (let game = 0; game < 30; game += 1) {
      const die = seededRoller(game * 13 + 3);
      let state = initialState();
      for (let round = 0; round < 200; round += 1) {
        state = applyRoll(state, die(), CLASSIC).state;
        seen.push(state);
      }
    }
    return seen;
  }

  const all = states();

  it('only ever waits when the engine says the game has not begun', () => {
    // The invariant the defect broke: waiting and winning are different, and
    // the only thing that distinguishes them is `hasWon`.
    for (const state of all) {
      const show = headline(state, 'en', titleOf);
      expect(show.waiting, JSON.stringify(state)).toBe(state.is_finished && !hasWon(state));
    }
  });

  it('never points at a square that is not on the board', () => {
    for (const state of all) {
      const show = headline(state, 'en', titleOf);
      for (const square of [show.here, show.from]) {
        if (square === null) continue;
        expect(Number.isInteger(square)).toBe(true);
        expect(square).toBeGreaterThanOrEqual(1);
        expect(square).toBeLessThanOrEqual(TOTAL_PLANS);
      }
    }
  });

  it('never traces a move out of the win square', () => {
    // Entering the game is recorded as a move from 68, because that is where a
    // waiting player sits. Drawing that trail tells the player they have just
    // come down from Cosmic Consciousness. Nobody moves out of 68 in play.
    const entered = applyRoll(initialState(), MAX_ROLL, CLASSIC).state;
    expect(entered.previous_loka).toBe(WIN_LOKA);
    expect(headline(entered, 'en', titleOf).from).toBeNull();

    for (const state of all) {
      expect(headline(state, 'en', titleOf).from, JSON.stringify(state)).not.toBe(WIN_LOKA);
    }
  });

  it('never traces a move from the square the player is standing on', () => {
    for (const state of all) {
      const show = headline(state, 'en', titleOf);
      if (show.from !== null) expect(show.from).not.toBe(show.here);
    }
  });

  it('keeps the bar inside the board', () => {
    for (const state of all) {
      const { progress } = headline(state, 'en', titleOf);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(WIN_LOKA);
    }
  });

  it('always has something to put in the header', () => {
    for (const state of all) {
      const show = headline(state, 'en', titleOf);
      expect(show.number.length).toBeGreaterThan(0);
      expect(show.title.length).toBeGreaterThan(0);
    }
  });
});
