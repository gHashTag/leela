import { describe, expect, it } from 'vitest';
import { CLASSIC, LEGACY_MOBILE, NEUROLEELA, WIN_LOKA, applyRoll, initialState } from '@leela/engine';
import {
  canPlayerRoll,
  gameStepRow,
  playerUpdateFromState,
  rulesForPlayer,
  stateFromPlayer,
  turnContextFromPlayer,
} from '../src';

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

describe('the gate reaches a lone player row', () => {
  // `needs_report` was written in three places and read in none — the exact
  // defect this project found in NeuroLeela, documented in a comment, and then
  // reproduced. A session carries `reportSubmitted`; a row in `players` had the
  // flag and no way to reach `canRoll` with it.

  const NOW = 1_700_000_000_000;

  it('blocks a player who owes a report, under a variant that gates', () => {
    const owing = row({ ruleset: 'classic', needsReport: true, lastRollAt: null });
    const verdict = canPlayerRoll(owing, NOW);

    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('report-required');
  });

  it('lets them through once the debt is cleared', () => {
    const paid = row({ ruleset: 'classic', needsReport: false, lastRollAt: null });
    expect(canPlayerRoll(paid, NOW).allowed).toBe(true);
  });

  it('ignores the flag under a variant that never gated', () => {
    const owing = row({ ruleset: 'neuroleela', needsReport: true, lastRollAt: null });
    expect(canPlayerRoll(owing, NOW).allowed).toBe(true);
  });

  it('honours the cooldown from the row’s own clock', () => {
    const justRolled = row({
      ruleset: 'online',
      needsReport: false,
      lastRollAt: new Date(NOW),
    });

    expect(canPlayerRoll(justRolled, NOW + 1000).reason).toBe('cooldown');
    expect(canPlayerRoll(justRolled, NOW + 24 * 60 * 60 * 1000).allowed).toBe(true);
  });

  it('reads a null flag as nothing owed, which is what the column default means', () => {
    const fresh = row({ ruleset: 'classic', needsReport: null, lastRollAt: null });
    expect(turnContextFromPlayer(fresh, NOW).reportSubmitted).toBe(true);
  });

  it('reads a null timestamp as never having rolled', () => {
    expect(turnContextFromPlayer(row({ lastRollAt: null }), NOW).lastRollAt).toBeNull();
  });

  it('closes the loop with playerUpdateFromState, which writes the flag', () => {
    // What the write records, the read must be able to act on.
    const { state } = applyRoll(stateFromPlayer(row({ plan: 11 })), 4, CLASSIC);
    const update = playerUpdateFromState(state);
    expect(update.needsReport).toBe(true);

    const stored = row({
      ruleset: 'classic',
      needsReport: update.needsReport,
      lastRollAt: new Date(NOW),
      plan: update.plan,
      previous_plan: update.previous_plan,
      isFinished: update.isFinished,
    });
    expect(canPlayerRoll(stored, NOW + 1000).reason).toBe('report-required');
  });
});
