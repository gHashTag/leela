import { describe, expect, it } from 'vitest';
import { LEGACY_MOBILE, WIN_LOKA, applyRoll, canRoll } from '@leela/engine';
import {
  LegacyMigrationError,
  migrateBatch,
  playerFromLegacy,
  stateFromLegacy,
  type LegacyUser,
} from '../src/legacy';

const T0 = 1_700_000_000_000;

function legacy(overrides: Partial<LegacyUser> = {}): LegacyUser {
  return {
    email: 'a@example.com',
    finish: false,
    firstGame: false,
    firstName: 'Ada',
    lastName: 'Lovelace',
    lastStepTime: T0,
    owner: 'firebase-uid-1',
    plan: 23,
    start: true,
    isReported: true,
    history: [
      { plan: 23, count: 4, status: 'arrow', createDate: T0 },
      { plan: 10, count: 4, status: 'cube', createDate: T0 - 1000 },
      { plan: 6, count: 6, status: 'start', createDate: T0 - 2000 },
    ],
    ...overrides,
  };
}

describe('stateFromLegacy', () => {
  it('reads a player who is mid-game', () => {
    expect(stateFromLegacy(legacy())).toEqual({
      loka: 23,
      previous_loka: 10,
      direction: 'arrow 🏹',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    });
  });

  it('parks a player who never entered the game on the win square', () => {
    const state = stateFromLegacy(legacy({ start: false, plan: 68, history: [] }));
    expect(state.loka).toBe(WIN_LOKA);
    expect(state.is_finished).toBe(true);
  });

  it('parks a player who already won', () => {
    const state = stateFromLegacy(legacy({ finish: true, plan: 68 }));
    expect(state.loka).toBe(WIN_LOKA);
    expect(state.is_finished).toBe(true);
  });

  it('reads the previous plan from history rather than inventing one', () => {
    expect(stateFromLegacy(legacy()).previous_loka).toBe(10);
  });

  it('treats a player with no history as not having moved', () => {
    // Equal plans is what owesReport and the report gate key off.
    const state = stateFromLegacy(legacy({ history: [], plan: 15 }));
    expect(state.previous_loka).toBe(15);
    expect(state.loka).toBe(15);
  });

  it('does not trust the stored order of history', () => {
    // The app unshifts, but an export may well come back sorted the other way.
    const reversed = legacy({ history: [...legacy().history].reverse() });
    expect(stateFromLegacy(reversed).previous_loka).toBe(10);
    expect(stateFromLegacy(reversed).direction).toBe('arrow 🏹');
  });

  it('maps each history status onto a direction', () => {
    const cases: Array<[string, string]> = [
      ['snake', 'snake 🐍'],
      ['arrow', 'arrow 🏹'],
      ['liberation', 'win 🕉'],
      ['cube', 'step 🚶🏼'],
      ['start', ''],
      ['something-new', ''],
    ];
    for (const [status, direction] of cases) {
      const user = legacy({ history: [{ plan: 23, count: 1, status, createDate: T0 }] });
      expect(stateFromLegacy(user).direction, status).toBe(direction);
    }
  });

  it('carries no run of sixes, because the legacy app never tracked one', () => {
    const state = stateFromLegacy(legacy());
    expect(state.consecutive_sixes).toBe(0);
    expect(state.position_before_three_sixes).toBe(0);
  });

  it('refuses a plan off the board rather than storing it', () => {
    for (const plan of [0, 73, -1, 1.5]) {
      expect(() => stateFromLegacy(legacy({ plan })), `plan ${plan}`).toThrow(
        LegacyMigrationError,
      );
    }
  });
});

describe('playerFromLegacy', () => {
  it('keeps the migrated player on the rules they installed', () => {
    expect(playerFromLegacy(legacy(), 'new-1').ruleset).toBe('legacy-mobile');
  });

  it('preserves the Firebase uid for reconciliation', () => {
    const row = playerFromLegacy(legacy(), 'new-1');
    expect(row.id).toBe('new-1');
    expect(row.legacyId).toBe('firebase-uid-1');
  });

  it('joins the name, and leaves it unset when there is none', () => {
    expect(playerFromLegacy(legacy(), 'x').fullName).toBe('Ada Lovelace');
    expect(
      playerFromLegacy(legacy({ firstName: '', lastName: '' }), 'x').fullName,
    ).toBeUndefined();
  });

  it('does not hand an unreported player a free roll', () => {
    expect(playerFromLegacy(legacy({ isReported: false }), 'x').needsReport).toBe(true);
    expect(playerFromLegacy(legacy({ isReported: true }), 'x').needsReport).toBe(false);
  });

  it('carries the last roll time, and leaves it null for someone who never rolled', () => {
    expect(playerFromLegacy(legacy(), 'x').lastRollAt).toEqual(new Date(T0));
    expect(playerFromLegacy(legacy({ lastStepTime: 0 }), 'x').lastRollAt).toBeNull();
  });

  it('reduces a loose locale to a primary subtag', () => {
    expect(playerFromLegacy(legacy({ lang: 'ru-RU' }), 'x').language).toBe('ru');
    expect(playerFromLegacy(legacy({ lang: 'EN_us' }), 'x').language).toBe('en');
    expect(playerFromLegacy(legacy({ lang: undefined }), 'x').language).toBe('en');
    expect(playerFromLegacy(legacy({ lang: 'nonsense' }), 'x').language).toBe('en');
  });
});

describe('a migrated player can keep playing', () => {
  it('resumes from exactly where they stood', () => {
    const state = stateFromLegacy(legacy({ plan: 11, history: [] }));
    const { state: next } = applyRoll(state, 4, LEGACY_MOBILE);
    expect(next.previous_loka).toBe(11);
    expect(next.loka).toBe(15);
  });

  it('keeps the extra throw on a six that the legacy app gave them', () => {
    const state = stateFromLegacy(legacy({ plan: 11, history: [] }));
    expect(applyRoll(state, 6, LEGACY_MOBILE).event.grantsExtraTurn).toBe(true);
  });

  it('is not blocked by a gate their variant never had', () => {
    const state = stateFromLegacy(legacy({ isReported: false }));
    const verdict = canRoll(
      state,
      { reportSubmitted: false, lastRollAt: T0, now: T0 + 1 },
      LEGACY_MOBILE,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('needs only a six to re-enter after having won', () => {
    const state = stateFromLegacy(legacy({ finish: true, plan: 68 }));
    expect(applyRoll(state, 3, LEGACY_MOBILE).state.loka).toBe(WIN_LOKA);
    expect(applyRoll(state, 6, LEGACY_MOBILE).state.loka).toBe(6);
  });
});

describe('migrateBatch', () => {
  it('converts everyone it can and reports the rest', () => {
    const users = [
      legacy({ owner: 'ok-1', plan: 10 }),
      legacy({ owner: 'bad-1', plan: 99 }),
      legacy({ owner: 'ok-2', plan: 40 }),
    ];

    const { migrated, failures } = migrateBatch(users, (u) => `new-${u.owner}`);

    expect(migrated.map((p) => p.legacyId)).toEqual(['ok-1', 'ok-2']);
    expect(failures).toHaveLength(1);
    expect(failures[0].owner).toBe('bad-1');
    expect(failures[0].reason).toMatch(/off the board/);
  });

  it('does not stop at the first bad row', () => {
    const users = [legacy({ owner: 'bad', plan: 0 }), legacy({ owner: 'good', plan: 5 })];
    expect(migrateBatch(users, (u) => u.owner).migrated).toHaveLength(1);
  });

  it('handles an empty export', () => {
    expect(migrateBatch([], (u) => u.owner)).toEqual({ migrated: [], failures: [] });
  });
});
