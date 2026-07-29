/**
 * The one entry point every client should call: `applyRoll`.
 *
 * It takes the state you persisted and a die value, and returns the state to
 * persist next plus a description of what happened. No I/O, no globals, no
 * clock. Persisting the result and telling the player about it are the
 * caller's job.
 */

import { MAX_ROLL, START_LOKA, TOTAL_PLANS, WIN_LOKA } from './board';
import { getDirectionAndPosition, handleConsecutiveSixes } from './rules';
import { DEFAULT_RULESET, type RuleSet } from './rulesets';
import type { GameState, MoveResult } from './types';

/**
 * The state a player starts with: waiting on Cosmic Consciousness for the six
 * that lets them into the game.
 */
export function initialState(): GameState {
  return {
    loka: WIN_LOKA,
    previous_loka: 0,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: true,
  };
}

/**
 * Apply one die value to one player's state.
 *
 * @param rules  Which variant to play. Defaults to what the newest shipped
 *               code plays, so adopting the engine changes nothing for
 *               existing players. See `rulesets.ts`.
 * @throws RangeError when `roll` is not an integer in 1..6.
 */
export function applyRoll(
  state: GameState,
  roll: number,
  rules: RuleSet = DEFAULT_RULESET,
): MoveResult {
  if (!Number.isInteger(roll) || roll < 1 || roll > MAX_ROLL) {
    throw new RangeError(`roll must be an integer in 1..${MAX_ROLL}, got ${roll}`);
  }

  // --- Waiting to enter the game -------------------------------------------
  // A player on WIN_LOKA with is_finished set has either not started yet or
  // has already won. Only a six lets them (re)enter.
  if (state.loka === WIN_LOKA && state.is_finished) {
    if (roll === MAX_ROLL) {
      return {
        state: {
          loka: START_LOKA,
          previous_loka: WIN_LOKA,
          direction: 'step 🚶🏼',
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: false,
        },
        event: {
          roll,
          from: WIN_LOKA,
          to: START_LOKA,
          direction: 'step 🚶🏼',
          isGameStart: true,
          isGameFinished: false,
          isThreeSixesReset: false,
          isBlocked: false,
          jumpedFrom: null,
          // Entering the game consumes the six; the turn passes either way.
          grantsExtraTurn: false,
        },
      };
    }

    // Not a six: stay and keep waiting. Note that previous_loka is carried
    // over untouched, matching the shipped implementation.
    return {
      state: {
        loka: WIN_LOKA,
        previous_loka: state.previous_loka,
        direction: 'stop 🛑',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: true,
      },
      event: {
        roll,
        from: WIN_LOKA,
        to: WIN_LOKA,
        direction: 'stop 🛑',
        isGameStart: false,
        isGameFinished: true,
        isThreeSixesReset: false,
        isBlocked: true,
        jumpedFrom: null,
        grantsExtraTurn: false,
      },
    };
  }

  // --- Active game ----------------------------------------------------------
  const sixes = handleConsecutiveSixes(
    roll,
    state.loka,
    state.consecutive_sixes,
    state.position_before_three_sixes,
    rules.threeSixesReset,
  );

  // On a third six the tentative position is the fallback square, which is
  // then run through the board rules like any other landing. That means a
  // fallback square carrying a snake or an arrow moves the player again.
  // Preserved deliberately: this is how every shipped version behaved.
  const resolved = getDirectionAndPosition(
    sixes.newPosition,
    state.is_finished,
    roll,
    state.loka,
  );

  const isThreeSixesReset = sixes.direction !== undefined;
  const direction = sixes.direction ?? resolved.direction;

  const nextState: GameState = {
    loka: resolved.finalLoka,
    previous_loka: state.loka,
    direction,
    consecutive_sixes: sixes.newConsecutive,
    position_before_three_sixes: sixes.newBeforeThreeSixes,
    is_finished: resolved.isGameFinished,
  };

  const jumped =
    (resolved.direction === 'snake 🐍' || resolved.direction === 'arrow 🏹') &&
    resolved.finalLoka !== sixes.newPosition;

  return {
    state: nextState,
    event: {
      roll,
      from: state.loka,
      to: resolved.finalLoka,
      direction,
      isGameStart: false,
      isGameFinished: resolved.isGameFinished,
      isThreeSixesReset,
      isBlocked: resolved.direction === 'stop 🛑',
      jumpedFrom: jumped ? sixes.newPosition : null,
      // A six keeps the turn, unless it was the third of a run that just
      // burned, or the game has ended.
      grantsExtraTurn:
        rules.extraTurnOnSix &&
        roll === MAX_ROLL &&
        !isThreeSixesReset &&
        !resolved.isGameFinished,
    },
  };
}

/**
 * Play a whole game from a fixed sequence of die values.
 * Useful for tests, replays and for verifying a chain of moves off-chain.
 */
export function replay(
  rolls: readonly number[],
  from: GameState = initialState(),
  rules: RuleSet = DEFAULT_RULESET,
): MoveResult[] {
  const results: MoveResult[] = [];
  let state = from;
  for (const roll of rolls) {
    const result = applyRoll(state, roll, rules);
    results.push(result);
    state = result.state;
  }
  return results;
}

/** True when the state represents a player who has won and left the board. */
export function hasWon(state: GameState): boolean {
  return state.loka === WIN_LOKA && state.is_finished;
}

/** Squares on the board, 1..72, as a plain array. Handy for rendering. */
export function allPlans(): number[] {
  return Array.from({ length: TOTAL_PLANS }, (_, i) => i + 1);
}
