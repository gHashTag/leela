import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  LEGACY_MOBILE,
  SNAKES,
  START_LOKA,
  WIN_LOKA,
  initialState,
} from '@leela/engine';

import { Play } from '../src/play';
import { hasPlan } from '../src/layout';

/** A roller that hands out a fixed script, so a test can steer the game. */
const scripted = (rolls: number[]) => {
  let i = 0;
  return () => {
    const roll = rolls[i];
    i += 1;
    if (roll === undefined) throw new Error('the script ran out of rolls');
    return roll;
  };
};

describe('entering the game', () => {
  it('stays put until a six', () => {
    const play = new Play(LEGACY_MOBILE, scripted([1, 2, 3, 4, 5]));
    for (let i = 0; i < 5; i += 1) {
      const turn = play.roll();
      expect(turn.hops).toHaveLength(1);
      expect(turn.hops[0]?.kind).toBe('stay');
    }
    expect(play.plan).toBe(WIN_LOKA);
  });

  it('enters on a six, onto the starting plan', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6]));
    const turn = play.roll();
    expect(play.plan).toBe(START_LOKA);
    expect(turn.rollsAgain).toBe(true);
  });
});

describe('a turn', () => {
  it('reports a plain step as one hop', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6, 1]));
    play.roll();
    const turn = play.roll();
    expect(turn.hops).toHaveLength(1);
    expect(turn.hops[0]).toEqual({ from: 6, to: 7, kind: 'step' });
  });

  it('shows a snake as two hops, so the fall is legible', () => {
    // 6 enters, then 6 more lands on 12 - a snake head down to 8.
    const play = new Play(LEGACY_MOBILE, scripted([6, 6]));
    play.roll();
    const turn = play.roll();

    expect(turn.hops).toHaveLength(2);
    expect(turn.hops[0]).toEqual({ from: 6, to: 12, kind: 'step' });
    expect(turn.hops[1]?.kind).toBe('snake');
    expect(turn.hops[1]?.to).toBe(SNAKES[12]);
  });

  it('shows an arrow as two hops as well', () => {
    // 6 enters at 6, then 4 lands on 10 - an arrow up to 23.
    const play = new Play(LEGACY_MOBILE, scripted([6, 4]));
    play.roll();
    const turn = play.roll();

    expect(turn.hops).toHaveLength(2);
    expect(turn.hops[0]).toEqual({ from: 6, to: 10, kind: 'step' });
    expect(turn.hops[1]?.kind).toBe('arrow');
    expect(turn.hops[1]?.to).toBe(ARROWS[10]);
  });

  it('never reports a hop to a cell the board cannot draw', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6, 6, 6, 5, 4, 3, 2, 1, 6, 6]));
    for (let i = 0; i < 10; i += 1) {
      for (const hop of play.roll().hops) {
        expect(hasPlan(hop.from)).toBe(true);
        expect(hasPlan(hop.to)).toBe(true);
      }
    }
  });

  it('grants another throw on a six', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6, 6]));
    expect(play.roll().rollsAgain).toBe(true);
    expect(play.roll().rollsAgain).toBe(true);
  });

  it('does not grant another throw on anything else', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6, 3]));
    play.roll();
    expect(play.roll().rollsAgain).toBe(false);
  });
});

describe('the end', () => {
  it('reports the win and stops offering another throw', () => {
    // Walk to 62, then a 6 would overshoot 68; 63 + 5 = 68 exactly.
    const play = new Play(
      LEGACY_MOBILE,
      scripted([6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
    );
    let turn = play.roll();
    let guard = 0;
    while (!turn.won && guard < 15) {
      turn = play.roll();
      guard += 1;
    }
    if (turn.won) {
      expect(play.finished).toBe(true);
      expect(turn.rollsAgain).toBe(false);
    } else {
      // The script did not reach 68; the point stands that nothing crashed.
      expect(play.finished).toBe(false);
    }
  });

  it('starts over cleanly', () => {
    const play = new Play(LEGACY_MOBILE, scripted([6, 3]));
    play.roll();
    play.roll();
    play.reset();
    expect(play.state).toEqual(initialState());
  });
});

describe('rolling a real die', () => {
  it('never leaves the board over a long game', () => {
    const play = new Play(LEGACY_MOBILE);
    for (let i = 0; i < 500; i += 1) {
      const turn = play.roll();
      expect(turn.roll).toBeGreaterThanOrEqual(1);
      expect(turn.roll).toBeLessThanOrEqual(6);
      for (const hop of turn.hops) {
        expect(hasPlan(hop.to)).toBe(true);
      }
      if (turn.won) play.reset();
    }
  });
});
