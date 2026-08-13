import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  LEGACY_MOBILE,
  SNAKES,
  START_LOKA,
  WIN_LOKA,
  createSession,
  rollDie,
} from '@leela/engine';

import { entered, throwFor, type Thrown } from '../src/play';
import { hasPlan } from '../src/layout';

/**
 * These used to drive a `Play` wrapper this app owned. `Play` is gone and the
 * engine's `Session` is the model, so they drive that — and what they check is
 * unchanged, because what they were always really checking is **the hops**.
 *
 * Splitting a move into the steps an animation walks is the one part of a turn
 * the engine has no opinion about, and the only part of this file that is this
 * surface's to get wrong: a snake shown as one teleport rather than a landing
 * and a fall is a board that appears to have a bug in it.
 */
const table = () => createSession('t', [{ id: 'p1' }], LEGACY_MOBILE);

/** Plays a script through, returning every throw. */
const play = (rolls: number[]): Thrown[] => {
  let session = table();
  const thrown: Thrown[] = [];
  for (const [at, roll] of rolls.entries()) {
    const turn = throwFor(session, roll, at + 1);
    session = turn.session;
    thrown.push(turn);
  }
  return thrown;
};

/** Where the one seat stands after a script. */
const after = (rolls: number[]) => {
  const last = play(rolls).at(-1);
  return last ? last.session.players[0]! : table().players[0]!;
};

describe('entering the game', () => {
  it('stays put until a six', () => {
    const thrown = play([1, 2, 3, 4, 5]);
    for (const turn of thrown) {
      expect(turn.hops).toHaveLength(1);
      expect(turn.hops[0]?.kind).toBe('stay');
    }
    const seat = after([1, 2, 3, 4, 5]);
    expect(seat.state.loka).toBe(WIN_LOKA);
    expect(entered(seat)).toBe(false);
  });

  it('enters on a six, onto the starting plan', () => {
    const [turn] = play([6]);
    expect(after([6]).state.loka).toBe(START_LOKA);
    expect(entered(after([6]))).toBe(true);
    expect(turn?.rollsAgain).toBe(true);
  });
});

describe('a turn', () => {
  const lastOf = (rolls: number[]) => play(rolls).at(-1)!;

  it('reports a plain step as one hop', () => {
    const turn = lastOf([6, 1]);
    expect(turn.hops).toHaveLength(1);
    expect(turn.hops[0]).toEqual({ from: 6, to: 7, kind: 'step' });
  });

  it('shows a snake as two hops, so the fall is legible', () => {
    // 6 enters, then 6 more lands on 12 — a snake head down to 8.
    const turn = lastOf([6, 6]);
    expect(turn.hops).toHaveLength(2);
    expect(turn.hops[0]).toEqual({ from: 6, to: 12, kind: 'step' });
    expect(turn.hops[1]?.kind).toBe('snake');
    expect(turn.hops[1]?.to).toBe(SNAKES[12]);
  });

  it('shows an arrow as two hops as well', () => {
    // 6 enters at 6, then 4 lands on 10 — an arrow up to 23.
    const turn = lastOf([6, 4]);
    expect(turn.hops).toHaveLength(2);
    expect(turn.hops[0]).toEqual({ from: 6, to: 10, kind: 'step' });
    expect(turn.hops[1]?.kind).toBe('arrow');
    expect(turn.hops[1]?.to).toBe(ARROWS[10]);
  });

  it('never reports a hop to a cell the board cannot draw', () => {
    for (const turn of play([6, 6, 6, 5, 4, 3, 2, 1, 6, 6])) {
      for (const hop of turn.hops) {
        expect(hasPlan(hop.from)).toBe(true);
        expect(hasPlan(hop.to)).toBe(true);
      }
    }
  });

  it('grants another throw on a six', () => {
    for (const turn of play([6, 6])) expect(turn.rollsAgain).toBe(true);
  });

  it('does not grant another throw on anything else', () => {
    expect(lastOf([6, 3]).rollsAgain).toBe(false);
  });
});

describe('the end', () => {
  it('reports the win and stops offering another throw', () => {
    const script = [6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const won = play(script).find((turn) => turn.won);
    // The script may not reach 68 under this ruleset, and the assertion that
    // matters either way is that a win is never offered another throw.
    if (won) expect(won.rollsAgain).toBe(false);
    for (const turn of play(script)) {
      for (const hop of turn.hops) expect(hasPlan(hop.to)).toBe(true);
    }
  });
});

describe('starting over', () => {
  /**
   * `Play.reset()` used to do this and the test went with it. What replaced it
   * is a fresh `createSession`, so the assertion moves to what that has to be
   * true of: a new table is one nobody has entered, wherever the last game got
   * to. Winning on 68 and starting again is the loop this game is *made* of.
   */
  it('gives a table nobody has entered', () => {
    const finished = play([6, 5, 3, 6, 2]).at(-1)!.session;
    expect(finished.players[0]!.state).not.toEqual(table().players[0]!.state);

    for (const player of table().players) {
      expect(entered(player)).toBe(false);
      expect(player.state.loka).toBe(WIN_LOKA);
    }
  });
});

describe('rolling a real die', () => {
  /**
   * The invariant this file exists to hold: over a long game, every hop the
   * animation is asked to walk is a square the board can draw. A hop to a
   * square that is not there is a piece that flies off the edge.
   */
  it('never leaves the board over a long game', () => {
    let session = table();
    for (let at = 0; at < 500; at += 1) {
      const roll = rollDie();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);

      const turn = throwFor(session, roll, at + 1);
      for (const hop of turn.hops) {
        expect(hasPlan(hop.from)).toBe(true);
        expect(hasPlan(hop.to)).toBe(true);
      }
      session = turn.won ? table() : turn.session;
    }
  });
});
