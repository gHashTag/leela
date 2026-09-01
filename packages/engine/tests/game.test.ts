import { describe, expect, it } from 'vitest';
import {
  MAX_ROLL,
  NEUROLEELA,
  START_LOKA,
  TOTAL_PLANS,
  WIN_LOKA,
  applyRoll,
  hasWon,
  advance,
  createSession,
  initialState,
  isSessionOver,
  replay,
  type GameState,
} from '../src';

/** A state in mid-game, with every field explicit so tests read clearly. */
function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    loka: 10,
    previous_loka: 5,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
    ...overrides,
  };
}

describe('applyRoll — input guarding', () => {
  it('rejects rolls outside 1..6', () => {
    for (const bad of [0, 7, -1, 1.5, NaN]) {
      expect(() => applyRoll(playing(), bad)).toThrow(RangeError);
    }
  });

  it('never mutates the state it was given', () => {
    const before = playing();
    const snapshot = { ...before };
    applyRoll(before, 4);
    expect(before).toEqual(snapshot);
  });
});

describe('applyRoll — entering the game', () => {
  it('starts a player on a six and moves them to plan 6', () => {
    const { state, event } = applyRoll(initialState(), 6);
    expect(state.loka).toBe(START_LOKA);
    expect(state.previous_loka).toBe(WIN_LOKA);
    expect(state.is_finished).toBe(false);
    expect(state.consecutive_sixes).toBe(0);
    expect(event.isGameStart).toBe(true);
    expect(event.direction).toBe('step 🚶🏼');
  });

  it('keeps a player waiting on anything but a six', () => {
    for (const roll of [1, 2, 3, 4, 5]) {
      const { state, event } = applyRoll(initialState(), roll);
      expect(state.loka).toBe(WIN_LOKA);
      expect(state.is_finished).toBe(true);
      expect(event.isBlocked).toBe(true);
      expect(event.direction).toBe('stop 🛑');
    }
  });

  it('does not count the entry six towards a run of sixes', () => {
    const first = applyRoll(initialState(), 6);
    expect(first.state.consecutive_sixes).toBe(0);
    const second = applyRoll(first.state, 6);
    expect(second.state.consecutive_sixes).toBe(1);
  });
});

describe('applyRoll — moving', () => {
  it('takes a plain step', () => {
    const { state, event } = applyRoll(playing({ loka: 11 }), 4);
    expect(state.loka).toBe(15);
    expect(state.previous_loka).toBe(11);
    expect(event.direction).toBe('step 🚶🏼');
    expect(event.jumpedFrom).toBeNull();
  });

  it('slides down a snake and reports where it was caught', () => {
    const { state, event } = applyRoll(playing({ loka: 10 }), 2); // 10 + 2 = 12 -> 8
    expect(state.loka).toBe(8);
    expect(event.direction).toBe('snake 🐍');
    expect(event.jumpedFrom).toBe(12);
  });

  it('climbs an arrow and reports where it was caught', () => {
    const { state, event } = applyRoll(playing({ loka: 18 }), 2); // 18 + 2 = 20 -> 32
    expect(state.loka).toBe(32);
    expect(event.direction).toBe('arrow 🏹');
    expect(event.jumpedFrom).toBe(20);
  });

  it('refuses a roll that would overshoot 72 and leaves the player in place', () => {
    const { state, event } = applyRoll(playing({ loka: 70 }), 5);
    expect(state.loka).toBe(70);
    expect(state.previous_loka).toBe(70);
    expect(event.isBlocked).toBe(true);
    expect(event.direction).toBe('stop 🛑');
  });

  it('allows a landing on the final square 72, which is a snake to 51', () => {
    const { state } = applyRoll(playing({ loka: 70 }), 2);
    expect(state.loka).toBe(51);
  });
});

describe('applyRoll — winning', () => {
  it('wins on an exact landing at 68', () => {
    const { state, event } = applyRoll(playing({ loka: 65 }), 3);
    expect(state.loka).toBe(WIN_LOKA);
    expect(state.is_finished).toBe(true);
    expect(event.direction).toBe('win 🕉');
    expect(event.isGameFinished).toBe(true);
    expect(hasWon(state)).toBe(true);
  });

  it('wins through the arrow at 54', () => {
    const { state, event } = applyRoll(playing({ loka: 53 }), 1);
    expect(state.loka).toBe(WIN_LOKA);
    expect(state.is_finished).toBe(true);
    expect(event.direction).toBe('arrow 🏹');
    expect(event.isGameFinished).toBe(true);
  });

  it('lets a winner start a new round with another six', () => {
    const won = applyRoll(playing({ loka: 65 }), 3).state;
    const again = applyRoll(won, 6);
    expect(again.state.loka).toBe(START_LOKA);
    expect(again.state.is_finished).toBe(false);
    expect(again.event.isGameStart).toBe(true);
  });
});

describe('applyRoll — three sixes', () => {
  it('sends the player back to where the run of sixes began', () => {
    let s = playing({ loka: 10, consecutive_sixes: 0, position_before_three_sixes: 0 });

    const first = applyRoll(s, 6); // 10 -> 16, snake to 4
    expect(first.state.position_before_three_sixes).toBe(10);
    expect(first.state.consecutive_sixes).toBe(1);
    s = first.state;

    const second = applyRoll(s, 6); // 4 -> 10
    expect(second.state.consecutive_sixes).toBe(2);
    expect(second.state.position_before_three_sixes).toBe(10);
    s = second.state;

    const third = applyRoll(s, 6);
    expect(third.state.consecutive_sixes).toBe(0);
    expect(third.event.isThreeSixesReset).toBe(true);
    expect(third.event.direction).toBe('snake 🐍');
    s = third.state;

    // The fallback square is 10, and 10 carries an arrow to 23, so the reset
    // lands the player there. Locked in because every shipped version has
    // behaved this way; change it only with a deliberate rules decision.
    expect(s.loka).toBe(23);
  });

  it('lands squarely on the fallback square when it carries no snake or arrow', () => {
    // Start the run from 11, which has neither a snake nor an arrow.
    let s = playing({ loka: 11, consecutive_sixes: 0, position_before_three_sixes: 0 });
    s = applyRoll(s, 6).state; // 11 -> 17 -> arrow to 69
    expect(s.position_before_three_sixes).toBe(11);
    s = applyRoll(s, 6).state; // 69 + 6 = 75, overshoots, stays on 69
    expect(s.consecutive_sixes).toBe(2);
    const third = applyRoll(s, 6);
    expect(third.state.loka).toBe(11);
    expect(third.event.isThreeSixesReset).toBe(true);
  });

  it('breaks the run when a non-six interrupts it', () => {
    let s = playing({ loka: 11 });
    s = applyRoll(s, 6).state;
    expect(s.consecutive_sixes).toBe(1);
    s = applyRoll(s, 3).state;
    expect(s.consecutive_sixes).toBe(0);
  });
});

describe('replay', () => {
  it('threads state through a fixed sequence of rolls', () => {
    const results = replay([6, 4, 2]);
    expect(results).toHaveLength(3);
    expect(results[0].state.loka).toBe(START_LOKA); // entered the game on plan 6
    expect(results[1].state.loka).toBe(23); // 6 + 4 = 10, arrow to 23
    expect(results[2].state.loka).toBe(25); // 23 + 2, a plain step
  });

  it('is deterministic', () => {
    const rolls = [6, 3, 5, 1, 6, 6, 2, 4, 4, 5];
    expect(replay(rolls).map((r) => r.state.loka)).toEqual(
      replay(rolls).map((r) => r.state.loka),
    );
  });
});

describe('invariants over exhaustive play', () => {
  it('never leaves the board, from any square and any roll', () => {
    for (let loka = 1; loka <= TOTAL_PLANS; loka++) {
      for (let roll = 1; roll <= MAX_ROLL; roll++) {
        for (const sixes of [0, 1, 2]) {
          const { state } = applyRoll(
            playing({ loka, consecutive_sixes: sixes, position_before_three_sixes: 1 }),
            roll,
          );
          expect(state.loka, `from ${loka} rolling ${roll} with ${sixes} sixes`)
            .toBeGreaterThanOrEqual(1);
          expect(state.loka).toBeLessThanOrEqual(TOTAL_PLANS);
        }
      }
    }
  });

  it('finishes a long random game without ever breaking an invariant', () => {
    // A fixed pseudo-random sequence keeps the test reproducible.
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed % MAX_ROLL) + 1;
    };

    let s = initialState();
    let won = false;
    for (let i = 0; i < 5000; i++) {
      const { state, event } = applyRoll(s, next());
      expect(state.loka).toBeGreaterThanOrEqual(1);
      expect(state.loka).toBeLessThanOrEqual(TOTAL_PLANS);
      expect(state.consecutive_sixes).toBeLessThan(3);
      if (event.isGameFinished && !event.isBlocked) won = true;
      s = state;
    }
    expect(won, 'a 5000 roll game should reach 68 at least once').toBe(true);
  });
});

describe('who counts as having won', () => {
  // `hasWon(initialState())` returned true: a player who had not yet rolled
  // once was a winner. It survived because nothing outside the tests called it
  // — an export nobody uses is logic nobody checks. The same condition was
  // written correctly inside session.ts, which is now the only copy.

  it('is not a player waiting to enter the game', () => {
    expect(hasWon(initialState())).toBe(false);
  });

  it('is not a player who failed to roll a six, however many times', () => {
    let state = initialState();
    for (const roll of [1, 2, 3, 4, 5, 1, 2]) state = applyRoll(state, roll).state;
    expect(hasWon(state)).toBe(false);
  });

  it('is a player who landed on 68 exactly', () => {
    const { state } = applyRoll(playing({ loka: 65 }), 3);
    expect(state.loka).toBe(WIN_LOKA);
    expect(hasWon(state)).toBe(true);
  });

  it('is a player carried to 68 by the arrow at 54', () => {
    expect(hasWon(applyRoll(playing({ loka: 53 }), 1).state)).toBe(true);
  });

  it('is not a player who is simply on the board', () => {
    for (let loka = 1; loka <= TOTAL_PLANS; loka++) {
      if (loka === WIN_LOKA) continue;
      expect(hasWon(playing({ loka })), `plan ${loka}`).toBe(false);
    }
  });

  it('stops being true once they re-enter with a six', () => {
    const won = applyRoll(playing({ loka: 65 }), 3).state;
    expect(hasWon(won)).toBe(true);
    expect(hasWon(applyRoll(won, 6).state)).toBe(false);
  });

  it('agrees with the session about who is done', () => {
    // Two implementations of one rule is how they came to disagree.
    let session = createSession('s', [{ id: 'a' }], NEUROLEELA);
    expect(isSessionOver(session)).toBe(false);
    expect(hasWon(session.players[0].state)).toBe(false);

    session = advance(session, 6, 1).session; // enters
    for (const roll of [4, 4, 4, 1]) session = advance(session, roll, 1).session;

    expect(hasWon(session.players[0].state)).toBe(isSessionOver(session));
  });
});
