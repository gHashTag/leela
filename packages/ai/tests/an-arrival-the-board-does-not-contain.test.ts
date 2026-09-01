/**
 * The companion is not allowed to name a jump this board does not contain.
 *
 * A third six burns the run and puts the player back where it began. The engine
 * has nowhere on the *state* to say so: `handleConsecutiveSixes` returns
 * `direction: 'snake ..'` for a reset, `applyRoll` recovers the truth as
 * `sixes.direction !== undefined` and writes it to the **event**, and
 * `GameState.direction` keeps the snake. Every reader on the event side is
 * right — `@leela/content` says *a third six, the run burns* and the bot's move
 * message says the same. This package is on the state side, and it was told a
 * snake.
 *
 * Measured before it was fixed. One player, CLASSIC, rolls 6,6,6,6:
 * the player enters on 6, is bitten from 12 down to 8, walks to 14, and the
 * third six of the run returns them to 6. The prompt read *They were brought
 * down here by a snake. They came from plan 14.* No snake on this board starts
 * anywhere near 14, and the only one that ends on 6 starts at 29.
 *
 * **Why this file plays games instead of listing directions.** The two tests
 * that already covered the arrival sentence — `prompts.test.ts` — hand
 * `systemPrompt` a `direction` literal and a `previousPlan` chosen by whoever
 * wrote the test. A literal can say anything, including an arrival no game can
 * produce, so those tests hold whatever the sentence happens to be. The rule
 * here is stated over states the **engine actually produced**, which is the
 * standard `apps/mobile` has been held to since the seeded-board work and this
 * package had not been: whatever the prompt claims about an arrival, the board
 * has to contain that claim.
 */

import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  MAX_ROLL,
  SNAKES,
  TOTAL_PLANS,
  applyRoll,
  initialState,
  replay,
  type Direction,
  type GameState,
} from '@leela/engine';

import { systemPrompt } from '../src/prompts';

const SNAKE_SENTENCE = 'They were brought down here by a snake.';
const ARROW_SENTENCE = 'They were carried up here by an arrow.';

/**
 * Whether one throw from `from` could land on a head that ends on `to`.
 *
 * Written out here rather than imported from `src`, because a test that asks
 * the implementation whether the implementation is right has measured nothing.
 * The board tables are the shared thing; the question asked of them is not.
 *
 * `from` is `GameState.previous_loka` — the square the player stood on *before
 * the throw*, not the head of the snake. That is the whole subtlety: a player
 * on 10 who throws a 2 lands on 12 and is taken to 8, and the state that
 * results is `previous_loka: 10, loka: 8`. `SNAKES[10]` is nothing, so a check
 * asking the board about `previous_loka` directly would call every real snake
 * in the game a lie.
 */
function theBoardHolds(
  jumps: Readonly<Record<number, number>>,
  from: number,
  to: number,
): boolean {
  for (let roll = 1; roll <= MAX_ROLL; roll += 1) {
    const head = from + roll;
    if (head <= TOTAL_PLANS && jumps[head] === to) return true;
  }
  return false;
}

/** The jump a prompt states about the arrival, or `null` when it states none. */
function jumpClaimedBy(prompt: string): 'snake' | 'arrow' | null {
  if (prompt.includes(SNAKE_SENTENCE)) return 'snake';
  if (prompt.includes(ARROW_SENTENCE)) return 'arrow';
  return null;
}

function promptFor(state: GameState, threeSixes?: boolean): string {
  return systemPrompt({
    plan: state.loka,
    language: 'en',
    direction: (state.direction || undefined) as Direction | undefined,
    previousPlan: state.previous_loka,
    ...(threeSixes === undefined ? {} : { threeSixes }),
  });
}

/**
 * A die that is deterministic and rolls far more sixes than a fair one.
 *
 * A fair die reaches three in a row about once in 216 throws, and the arrival
 * this file is about *only* happens then. The grid over-samples six so that a
 * few hundred games contain resets from dozens of different squares; every
 * other value is still produced, so ordinary walks, snakes, arrows, blocked
 * throws and wins all appear in the same sweep.
 *
 * mulberry32, seeded per game, so the grid is the same on every machine and a
 * failure names a reproducible game.
 */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Played {
  /** The state the engine produced. */
  state: GameState;
  /** Whether a third six produced it — from the event, which knows. */
  wasReset: boolean;
  /** The game and throw it came from, so a failure can be replayed. */
  where: string;
}

/** Every state a grid of seeded games produced. */
function grid(games = 400, throwsPerGame = 200): Played[] {
  const played: Played[] = [];

  for (let seed = 1; seed <= games; seed += 1) {
    const random = seeded(seed);
    let state = initialState();

    for (let index = 0; index < throwsPerGame; index += 1) {
      const roll = random() < 0.42 ? MAX_ROLL : 1 + Math.floor(random() * MAX_ROLL);
      const result = applyRoll(state, roll);
      state = result.state;
      played.push({
        state,
        wasReset: result.event.isThreeSixesReset,
        where: `seed ${seed}, throw ${index + 1}`,
      });
    }
  }

  return played;
}

const PLAYED = grid();

describe('whatever the prompt says about an arrival, the board contains it', () => {
  it('produced a grid worth asserting over', () => {
    // A generator that produced nothing would satisfy every invariant below
    // forever. So the grid declares what it contains before anything is asked
    // of it: states, and states of each kind the sentence is about.
    expect(PLAYED.length).toBeGreaterThan(1000);

    const claimed = PLAYED.filter((played) => jumpClaimedBy(promptFor(played.state)) !== null);
    expect(claimed.length, 'arrivals the prompt describes as a jump').toBeGreaterThan(100);

    const snakes = PLAYED.filter((played) => jumpClaimedBy(promptFor(played.state)) === 'snake');
    const arrows = PLAYED.filter((played) => jumpClaimedBy(promptFor(played.state)) === 'arrow');
    expect(snakes.length, 'real snakes described as snakes').toBeGreaterThan(10);
    expect(arrows.length, 'real arrows described as arrows').toBeGreaterThan(10);
  });

  it('produced three-sixes resets, which is the arrival this is about', () => {
    // The other way the invariant could hold vacuously: a grid of ordinary
    // walks. The reset is rare on a fair die and the grid exists to make it
    // common, so it says how common it managed to be.
    const resets = PLAYED.filter((played) => played.wasReset);
    expect(resets.length, 'three-sixes resets in the grid').toBeGreaterThan(50);

    const pairs = new Set(
      resets.map((played) => `${played.state.previous_loka}->${played.state.loka}`),
    );
    expect(pairs.size, 'distinct reset arrivals in the grid').toBeGreaterThan(20);
  });

  it('never states a jump the board cannot produce, over every state the engine played', () => {
    // The invariant, over the whole grid and in one sentence: if the prompt
    // says a snake brought them down, some throw from the square they left
    // reaches a snake that ends where they are — and the same for an arrow.
    for (const played of PLAYED) {
      const { previous_loka: from, loka: to } = played.state;
      const claim = jumpClaimedBy(promptFor(played.state));
      if (claim === null) continue;

      const jumps = claim === 'snake' ? SNAKES : ARROWS;
      expect(
        theBoardHolds(jumps, from, to),
        `${played.where}: the prompt says a ${claim} carried them ${from} -> ${to}, ` +
          'and this board holds no such jump from there',
      ).toBe(true);
    }
  });

  it('still says nothing false when the caller does know it was a burned run', () => {
    // The same invariant with `threeSixes` supplied, because a caller that
    // learns to pass it must not lose the guard: the flag replaces the jump
    // sentence, it does not switch the check off.
    for (const played of PLAYED) {
      const { previous_loka: from, loka: to } = played.state;
      const claim = jumpClaimedBy(promptFor(played.state, played.wasReset));
      if (claim === null) continue;

      expect(
        played.wasReset,
        `${played.where}: a burned run ${from} -> ${to} was still described as a ${claim}`,
      ).toBe(false);
      expect(
        theBoardHolds(claim === 'snake' ? SNAKES : ARROWS, from, to),
        `${played.where}: the prompt says a ${claim} carried them ${from} -> ${to}, ` +
          'and this board holds no such jump from there',
      ).toBe(true);
    }
  });
});

describe('the arrival a burned run actually is', () => {
  /**
   * The measured game from the report: enter on 6, bitten from 12 to 8, walk to
   * 14, and the third six of the run returns the player to 6.
   */
  const burned = (() => {
    const moves = replay([6, 6, 6, 6]);
    const last = moves[moves.length - 1];
    if (last === undefined) throw new Error('the grid produced no moves');
    return last;
  })();

  it('is the game this was found in', () => {
    // Stated so that a rules change which stops producing it fails here, rather
    // than quietly turning the three tests below into assertions about nothing.
    expect(burned.event.isThreeSixesReset).toBe(true);
    expect({ from: burned.state.previous_loka, to: burned.state.loka }).toEqual({
      from: 14,
      to: 6,
    });
    expect(burned.state.direction, 'the state still calls it a snake').toBe('snake 🐍');
  });

  it('is not described as a snake, even to a caller that only has the state', () => {
    const prompt = promptFor(burned.state);

    expect(prompt).not.toContain(SNAKE_SENTENCE);
    expect(prompt, 'and says the true, smaller thing').toContain('They came from plan 14.');
    expect(theBoardHolds(SNAKES, 14, 6), 'no snake on this board makes that jump').toBe(false);
  });

  it('is described as what it was, to a caller that carries the truth', () => {
    const prompt = promptFor(burned.state, true);

    expect(prompt).not.toContain(SNAKE_SENTENCE);
    expect(prompt).toContain('They rolled a third six in a row: the run burned');
    expect(prompt, 'and where the run had got to is still worth saying').toContain(
      'They came from plan 14.',
    );
  });
});

/**
 * The one arrival the board cannot tell from a snake, said out loud.
 *
 * The board check can only refuse what it can disprove, and for two of the 45
 * distinct resets the grid produced it cannot. A run that begins on 7 goes
 * 7, 13, 19 and burns back to 7 — and from 19 a throw of 5 reaches 24, where a
 * snake ends on 7. The board holds that jump, so the check has nothing to
 * object to and the companion is still told a snake. (The other is 47 -> 35,
 * the same shape through the snake at 52.)
 *
 * The way to close it is not a cleverer check. It is to carry the truth from
 * the event — `MoveEvent.isThreeSixesReset` — into `threeSixes` at the call
 * site, which is what the last assertion here shows working.
 *
 * A note on how this was derived, because the obvious derivation is wrong. A
 * reset does not always land twelve squares back: a snake or an arrow on either
 * of the two intermediate squares moves the player, so a run beginning on 23
 * can burn back to 23 from 8. The pass that opened this expected the miss to be
 * 16 -> 4 on the twelve-squares reading; 16 -> 4 never occurs in play at all.
 * These two were found by playing the grid, not by arithmetic.
 */
describe('the miss this fix does not close', () => {
  const burnedFromSeven = (() => {
    const moves = replay([6, 1, 6, 6, 6]);
    const last = moves[moves.length - 1];
    if (last === undefined) throw new Error('the grid produced no moves');
    return last;
  })();

  it('is a real game, and it really is indistinguishable', () => {
    expect(burnedFromSeven.event.isThreeSixesReset).toBe(true);
    expect({
      from: burnedFromSeven.state.previous_loka,
      to: burnedFromSeven.state.loka,
    }).toEqual({ from: 19, to: 7 });
    expect(theBoardHolds(SNAKES, 19, 7), 'the board really does hold that jump').toBe(true);
  });

  it('is still described as a snake, and this test exists so that is on the record', () => {
    expect(promptFor(burnedFromSeven.state)).toContain(SNAKE_SENTENCE);
  });

  it('stops being described as a snake the moment the caller carries the truth', () => {
    const prompt = promptFor(burnedFromSeven.state, true);

    expect(prompt).not.toContain(SNAKE_SENTENCE);
    expect(prompt).toContain('They rolled a third six in a row: the run burned');
  });
});
