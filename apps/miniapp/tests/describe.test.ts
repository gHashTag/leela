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
import { describeMove, attribute} from '../src/describe';

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
  return describeMove('en', applyRoll(state, roll, CLASSIC).event, titleOf);
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
          'en',
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
        const text = describeMove('en', event, titleOf);
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

describe('a player whose Telegram is Russian reads Russian', () => {
  // The mini app resolved the player's language and spent it entirely on the
  // plan texts, exactly as the bot did: the board was Russian and every
  // sentence about a move was English. The assertion is the shape — no Latin
  // prose in any reachable move — rather than a list of the wrong sentences.
  const russianTitle = (plan: number) => `План ${plan}`;

  function latinProseIn(text: string): string[] {
    return text.match(/[A-Za-z]+/g) ?? [];
  }

  it('says nothing Latin about any move from any square', () => {
    for (let loka = 1; loka <= TOTAL_PLANS; loka++) {
      for (let roll = 1; roll <= MAX_ROLL; roll++) {
        const { event } = applyRoll(playing({ loka }), roll, CLASSIC);
        const text = describeMove('ru', event, russianTitle);
        expect(latinProseIn(text), `from ${loka} rolling ${roll}: ${text}`).toEqual([]);
      }
    }
  });

  it('says nothing Latin about entering, or failing to', () => {
    for (let roll = 1; roll <= MAX_ROLL; roll++) {
      const { event } = applyRoll(initialState(), roll, CLASSIC);
      expect(latinProseIn(describeMove('ru', event, russianTitle))).toEqual([]);
    }
  });

  it('still answers in English for a language with no catalogue', () => {
    const { event } = applyRoll(initialState(), 6, CLASSIC);
    expect(describeMove('ja', event, russianTitle)).toContain('A six');
  });
});

describe('whose throw the sentence is about', () => {
  /**
   * The wording is second person — "You threw 4. An arrow at 10 takes you to
   * 23." — which was exact while one person played. At a table it is read
   * *after* the header has moved on to whoever throws next, so the sentence
   * appears to describe the wrong player's throw. Found by seating two and
   * reading the screen.
   *
   * The rule asserted is not the prefix: it is that a table names the thrower
   * and a lone player is not addressed by number.
   */

  const said = 'You threw 4. An arrow at 10 takes you to 23.';

  it('says nothing extra to somebody playing alone', () => {
    // "Player 1 — you threw four" to one person is a form filled in by a
    // machine.
    expect(attribute('en', said, 0, 1)).toBe(said);
  });

  it('names the thrower once there is more than one seat', () => {
    for (const seat of [0, 1, 5]) {
      const named = attribute('en', said, seat, 6);
      expect(named, `seat ${seat}`).toContain(String(seat + 1));
      expect(named, `seat ${seat}`).not.toBe(said);
    }
  });

  it('keeps the sentence it was given, whatever it was', () => {
    // The prefix is an attribution, not a rewrite: every word of the move
    // still has to reach the reader.
    for (const sentence of [said, 'A six puts you on the board.', 'ॐ']) {
      expect(attribute('en', sentence, 1, 3)).toContain(sentence);
    }
  });

  it('names the seat that threw, which is not always the one up next', () => {
    // The whole point: after a throw that passes the turn, the header says
    // one player and the sentence belongs to another.
    expect(attribute('en', said, 0, 2)).toContain('1');
    expect(attribute('en', said, 1, 2)).toContain('2');
  });

  it('speaks the language of the table', () => {
    expect(attribute('ru', 'Вы бросили 4.', 0, 2)).toMatch(/[А-Яа-я]/);
  });
});
