import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  MAX_ROLL,
  TOTAL_PLANS,
  WIN_LOKA,
  applyRoll,
  initialState,
  type GameState,
} from '@leela/engine';
import { describeMove } from '../src/describe';

const titleOf = (plan: number) => `Plan ${plan}`;

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    loka: 11,
    previous_loka: 5,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
    ...overrides,
  };
}

/** Describe whatever a roll produces from a given state. */
function saidAfter(state: GameState, roll: number): string {
  return describeMove(applyRoll(state, roll, CLASSIC).event, titleOf);
}

describe('entering the game', () => {
  it('says a six let the player in, and names where they landed', () => {
    const text = saidAfter(initialState(), 6);
    expect(text).toContain('A six');
    expect(text).toContain('Plan 6');
  });

  it('says a six is needed, rather than talking about room on the board', () => {
    for (const roll of [1, 2, 3, 4, 5]) {
      const text = saidAfter(initialState(), roll);
      expect(text, `roll ${roll}`).toContain('takes a six');
      // The bug this replaces: a rule the player is not under yet.
      expect(text).not.toContain('Not enough room');
    }
  });
});

describe('moving', () => {
  it('reads as a movement, from one square to another', () => {
    expect(saidAfter(playing({ loka: 11 }), 2)).toContain('11 → 13');
  });

  it('names a snake and where it caught the player', () => {
    // 10 + 2 = 12, a snake to 8.
    const text = saidAfter(playing({ loka: 10 }), 2);
    expect(text).toContain('A snake at 12');
    expect(text).toContain('Plan 8');
  });

  it('names an arrow and where it caught the player', () => {
    // 18 + 2 = 20, an arrow to 32.
    const text = saidAfter(playing({ loka: 18 }), 2);
    expect(text).toContain('An arrow at 20');
    expect(text).toContain('Plan 32');
  });

  it('says a throw was refused when it would overshoot', () => {
    const text = saidAfter(playing({ loka: 70 }), 5);
    expect(text).toContain('Not enough room');
    expect(text).toContain('70');
  });
});

describe('endings', () => {
  it('says the game is won without adding a number to it', () => {
    const text = saidAfter(playing({ loka: 65 }), 3);
    expect(text).toContain('Cosmic Consciousness');
  });

  it('says a run of sixes burned, and where it sent the player', () => {
    let state = playing({ loka: 11 });
    state = applyRoll(state, 6, CLASSIC).state;
    state = applyRoll(state, 6, CLASSIC).state;
    const text = saidAfter(state, 6);
    expect(text).toContain('A third six');
    expect(text).toContain('Plan 11');
  });
});

describe('every reachable move', () => {
  it('always produces a non-empty sentence', () => {
    for (let loka = 1; loka <= TOTAL_PLANS; loka++) {
      for (let roll = 1; roll <= MAX_ROLL; roll++) {
        const text = describeMove(
          applyRoll(playing({ loka }), roll, CLASSIC).event,
          titleOf,
        );
        expect(text.trim().length, `from ${loka} rolling ${roll}`).toBeGreaterThan(0);
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('NaN');
      }
    }
  });

  it('never claims a square outside the board', () => {
    for (let loka = 1; loka <= TOTAL_PLANS; loka++) {
      for (let roll = 1; roll <= MAX_ROLL; roll++) {
        const { event } = applyRoll(playing({ loka }), roll, CLASSIC);
        const text = describeMove(event, titleOf);
        const numbers = [...text.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1]));
        for (const number of numbers) {
          // The only numbers in a sentence are a die value or a square.
          const plausible = number <= MAX_ROLL || (number >= 1 && number <= TOTAL_PLANS);
          expect(plausible, `"${text}" mentions ${number}`).toBe(true);
        }
      }
    }
  });

  it('never says "not enough room" to someone who has not entered yet', () => {
    for (let roll = 1; roll <= MAX_ROLL; roll++) {
      const state = { ...initialState(), loka: WIN_LOKA };
      expect(saidAfter(state, roll)).not.toContain('Not enough room');
    }
  });
});
