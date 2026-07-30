import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  NEUROLEELA,
  WIN_LOKA,
  applyRoll,
  initialState,
  owesReport,
  ruleSetById,
  seededRoller,
} from '@leela/engine';
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
  /**
   * `needsReport` was written here by hand — `loka !== previous_loka &&
   * !is_finished` — which is `owesReport` as it stood a week ago, and wrong
   * three ways since. A player persisted through this mapping got a free throw
   * where the same game held in memory asked for a report: two surfaces
   * playing different games, which is the thing this repository exists to have
   * fixed once.
   *
   * So the assertion is no longer a list of cases. It is that the column
   * agrees with the engine, over every state a real game reaches.
   */
  it('writes what the engine says, on every state a real game reaches', () => {
    for (const id of ['classic', 'neuroleela', 'legacy-mobile', 'online'] as const) {
      const rules = ruleSetById(id);
      let state = stateFromPlayer(row({ plan: 1, previous_plan: 0 }));
      const die = seededRoller(9);

      for (let turn = 0; turn < 300; turn += 1) {
        const applied = applyRoll(state, die(), rules);
        state = applied.state;

        expect(playerUpdateFromState(state, rules).needsReport, `${id} turn ${turn}`).toBe(
          owesReport(state, rules),
        );

        if (state.is_finished && state.loka === WIN_LOKA) break;
      }
    }
  });

  it('asks for a report when the player moved and is still playing', () => {
    const { state } = applyRoll(stateFromPlayer(row({ plan: 11 })), 4);
    expect(playerUpdateFromState(state, CLASSIC).needsReport).toBe(true);
  });

  it('asks for no report when the roll was refused', () => {
    // The reason the old condition looked right: a throw that overshoots 72
    // leaves the player where they were, and there is nothing to write about.
    const { state } = applyRoll(stateFromPlayer(row({ plan: 70 })), 5);
    expect(state.loka).toBe(state.previous_loka);
    expect(playerUpdateFromState(state, CLASSIC).needsReport).toBe(false);
  });

  it('asks for a report on the winning square, which the old condition dismissed', () => {
    // `is_finished` covered two different things, and only one of them owes
    // nothing. The published app asks the winner every time.
    const { state } = applyRoll(stateFromPlayer(row({ plan: 65 })), 3);
    expect(state.loka).toBe(WIN_LOKA);
    expect(playerUpdateFromState(state, CLASSIC).needsReport).toBe(true);
  });

  it('asks for a report when a snake carries the player back to where they stood', () => {
    // 8 + 4 = 12, and the snake at 12 returns them to 8. The old condition read
    // that as no move at all.
    const { state } = applyRoll(stateFromPlayer(row({ plan: 8, previous_plan: 3 })), 4);
    expect(state.loka).toBe(state.previous_loka);
    expect(playerUpdateFromState(state, CLASSIC).needsReport).toBe(true);
  });

  it('asks the variant, which the old condition never did', () => {
    // A six owes no report under `legacy-mobile` and owes one under `classic`.
    const from = stateFromPlayer(row({ plan: 11 }));
    const { state } = applyRoll(from, 6, LEGACY_MOBILE);

    expect(playerUpdateFromState(state, LEGACY_MOBILE).needsReport).toBe(false);
    expect(playerUpdateFromState(state, CLASSIC).needsReport).toBe(true);
  });

  it('carries a custom message through', () => {
    const { state } = applyRoll(stateFromPlayer(row()), 3);
    expect(playerUpdateFromState(state, CLASSIC, 'hello').message).toBe('hello');
  });
});

describe('round trip', () => {
  it('reads a row, plays a move and writes a row the engine can read back', () => {
    let current = row({ plan: 11 });

    for (const roll of [6, 2, 4, 6, 6, 3]) {
      const state = stateFromPlayer(current);
      const { state: next } = applyRoll(state, roll, rulesForPlayer(current));
      const update = playerUpdateFromState(next, rulesForPlayer(current));

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
    // `online` measures the wait from the report, which is what the published
    // app does — `startStepTimer` runs when a post is created. The legacy
    // export's one timestamp is that moment, so it lands in both columns.
    const justWrote = row({
      ruleset: 'online',
      needsReport: false,
      lastRollAt: new Date(NOW),
      lastReportAt: new Date(NOW),
    });

    expect(canPlayerRoll(justWrote, NOW + 1000).reason).toBe('cooldown');
    expect(canPlayerRoll(justWrote, NOW + 24 * 60 * 60 * 1000).allowed).toBe(true);
  });

  it('does not hold a player who has never written', () => {
    // Nothing to measure from, and the report gate is the thing that stops
    // them until there is — a different sentence, and the true one.
    const neverWrote = row({
      ruleset: 'online',
      needsReport: false,
      lastRollAt: new Date(NOW),
      lastReportAt: null,
    });
    expect(canPlayerRoll(neverWrote, NOW + 1000).allowed).toBe(true);
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
    const update = playerUpdateFromState(state, CLASSIC);
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
