import { describe, expect, it } from 'vitest';
import { CLASSIC, LEGACY_MOBILE, NEUROLEELA, WIN_LOKA, applyRoll, initialState } from '@leela/engine';
import { gameStepRow, playerUpdateFromState, rulesForPlayer, stateFromPlayer } from '../src';

/** A player row as Postgres would hand it back. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    plan: 10,
    previous_plan: 5,
    consecutiveSixes: 0,
    positionBeforeThreeSixes: 0,
    isFinished: false,
    ruleset: 'neuroleela',
    ...overrides,
  } as never;
}

describe('stateFromPlayer', () => {
  it('reads a row as engine state', () => {
    expect(stateFromPlayer(row())).toEqual({
      loka: 10,
      previous_loka: 5,
      direction: '',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    });
  });

  it('survives the nulls Postgres allows on every optional column', () => {
    const state = stateFromPlayer(
      row({
        plan: null,
        previous_plan: null,
        consecutiveSixes: null,
        positionBeforeThreeSixes: null,
        isFinished: null,
      }),
    );
    expect(state.loka).toBe(1);
    expect(state.previous_loka).toBe(0);
    expect(state.consecutive_sixes).toBe(0);
    expect(state.is_finished).toBe(false);
  });
});

describe('playerUpdateFromState', () => {
  it('asks for a report when the player moved and is still playing', () => {
    const { state } = applyRoll(stateFromPlayer(row({ plan: 11 })), 4);
    expect(playerUpdateFromState(state).needsReport).toBe(true);
  });

  it('asks for no report when the roll was refused', () => {
    const { state } = applyRoll(stateFromPlayer(row({ plan: 70 })), 5);
    expect(state.loka).toBe(state.previous_loka);
    expect(playerUpdateFromState(state).needsReport).toBe(false);
  });

  it('asks for no report once the game is won', () => {
    const { state } = applyRoll(stateFromPlayer(row({ plan: 65 })), 3);
    expect(state.loka).toBe(WIN_LOKA);
    expect(playerUpdateFromState(state).needsReport).toBe(false);
  });

  it('carries a custom message through', () => {
    const { state } = applyRoll(stateFromPlayer(row()), 3);
    expect(playerUpdateFromState(state, 'hello').message).toBe('hello');
  });
});

describe('round trip', () => {
  it('reads a row, plays a move and writes a row the engine can read back', () => {
    let current = row({ plan: 11 });

    for (const roll of [6, 2, 4, 6, 6, 3]) {
      const state = stateFromPlayer(current);
      const { state: next } = applyRoll(state, roll, rulesForPlayer(current));
      const update = playerUpdateFromState(next);

      // What we would write back must read back as exactly the same state.
      current = row({
        plan: update.plan,
        previous_plan: update.previous_plan,
        consecutiveSixes: update.consecutiveSixes,
        positionBeforeThreeSixes: update.positionBeforeThreeSixes,
        isFinished: update.isFinished,
      });
      expect(stateFromPlayer(current)).toEqual({ ...next, direction: '' });
    }
  });
});

describe('gameStepRow', () => {
  it('records the move, including which variant produced it', () => {
    const { event } = applyRoll(stateFromPlayer(row({ plan: 10 })), 2); // snake 12 -> 8
    const step = gameStepRow('user-1', event, NEUROLEELA);

    expect(step).toMatchObject({
      user_id: 'user-1',
      roll: 2,
      from_plan: 10,
      to_plan: 8,
      direction: 'snake 🐍',
      jumped_from: 12,
      ruleset: 'neuroleela',
    });
  });

  it('marks the roll that started the game', () => {
    const { event } = applyRoll(initialState(), 6);
    expect(gameStepRow('u', event, CLASSIC)).toMatchObject({
      is_game_start: true,
      ruleset: 'classic',
    });
  });
});

describe('rulesForPlayer', () => {
  it('resolves each stored variant', () => {
    expect(rulesForPlayer(row({ ruleset: 'classic' })).id).toBe('classic');
    expect(rulesForPlayer(row({ ruleset: 'legacy-mobile' })).id).toBe('legacy-mobile');
    expect(rulesForPlayer(row({ ruleset: 'neuroleela' })).id).toBe('neuroleela');
  });

  it('defaults a row that predates the column', () => {
    expect(rulesForPlayer(row({ ruleset: null })).id).toBe('neuroleela');
  });

  it('keeps a migrated legacy account on the rules it was playing', () => {
    const legacy = row({ ruleset: 'legacy-mobile', plan: 11 });
    const rules = rulesForPlayer(legacy);
    expect(rules).toBe(LEGACY_MOBILE);
    // Under legacy rules a six grants another throw and never burns a run.
    const { event } = applyRoll(stateFromPlayer(legacy), 6, rules);
    expect(event.grantsExtraTurn).toBe(true);
  });
});
