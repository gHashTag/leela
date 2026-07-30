import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  NEUROLEELA,
  ONE_DAY_MS,
  ONLINE,
  applyRoll,
  canRoll,
  formatWait,
  initialState,
  owesReport,
  type GameState,
  type RuleSet,
} from '../src';

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    loka: 10,
    previous_loka: 5,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe('owesReport', () => {
  it('is owed after a move that changed the plan', () => {
    const { state } = applyRoll(playing({ loka: 11 }), 4);
    expect(owesReport(state)).toBe(true);
  });

  it('is not owed when the roll was refused', () => {
    const { state } = applyRoll(playing({ loka: 70 }), 5);
    expect(owesReport(state)).toBe(false);
  });

  it('is not owed once the game is won', () => {
    const { state } = applyRoll(playing({ loka: 65 }), 3);
    expect(owesReport(state)).toBe(false);
  });
});

describe('canRoll — report gate', () => {
  it('blocks a player who owes a report', () => {
    const verdict = canRoll(
      playing(),
      { reportSubmitted: false, lastRollAt: null, lastReportAt: null, now: NOW },
      CLASSIC,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('report-required');
    // Nothing to wait for — writing the report is the way through.
    expect(verdict.nextAllowedAt).toBeNull();
  });

  it('lets a player through once the report is filed', () => {
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: null, lastReportAt: null, now: NOW },
      CLASSIC,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('ignores reports under variants that do not gate on them', () => {
    for (const rules of [NEUROLEELA, LEGACY_MOBILE]) {
      const verdict = canRoll(
        playing(),
        { reportSubmitted: false, lastRollAt: null, lastReportAt: null, now: NOW },
        rules,
      );
      expect(verdict.allowed, rules.id).toBe(true);
    }
  });

  it('never gates a player still waiting to enter the game', () => {
    const verdict = canRoll(
      initialState(),
      { reportSubmitted: false, lastRollAt: NOW - 1000, lastReportAt: null, now: NOW },
      ONLINE,
    );
    expect(verdict.allowed).toBe(true);
  });
});

describe('canRoll — cooldown', () => {
  it('holds a player for a day after their report, under the published rules', () => {
    // `startStepTimer` is called from `CreatePost` and nowhere else: the day
    // begins when the player writes about where they landed, not when the die
    // was thrown. This test asserted the throw until the app was read.
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: NOW - ONE_DAY_MS, lastReportAt: NOW, now: NOW + 1000 },
      ONLINE,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('cooldown');
    expect(verdict.nextAllowedAt).toBe(NOW + ONE_DAY_MS);
    expect(verdict.waitMs).toBe(ONE_DAY_MS - 1000);
  });

  it('holds them from the throw when that is what the variant says', () => {
    const fromTheRoll: RuleSet = { ...ONLINE, cooldownFrom: 'roll' };
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: NOW, lastReportAt: null, now: NOW + 1000 },
      fromTheRoll,
    );
    expect(verdict.reason).toBe('cooldown');
    expect(verdict.nextAllowedAt).toBe(NOW + ONE_DAY_MS);
  });

  it('does not hold a player who has never written, under the published rules', () => {
    // Nothing to measure from. The report gate is what stops them, and it is a
    // different sentence: "write something" rather than "come back tomorrow".
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: NOW, lastReportAt: null, now: NOW + 1000 },
      ONLINE,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('releases them exactly when the day is up', () => {
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: NOW, lastReportAt: null, now: NOW + ONE_DAY_MS },
      ONLINE,
    );
    expect(verdict.allowed).toBe(true);
    expect(verdict.waitMs).toBe(0);
  });

  it('does not hold a player who has never rolled', () => {
    const verdict = canRoll(
      playing(),
      { reportSubmitted: true, lastRollAt: null, lastReportAt: null, now: NOW },
      ONLINE,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('asks for the report before mentioning the wait', () => {
    // Both gates are closed; the player is told to write, not to wait.
    const verdict = canRoll(
      playing(),
      { reportSubmitted: false, lastRollAt: NOW, lastReportAt: null, now: NOW + 1000 },
      ONLINE,
    );
    expect(verdict.reason).toBe('report-required');
  });

  it('applies no cooldown under the offline variants', () => {
    for (const rules of [CLASSIC, NEUROLEELA, LEGACY_MOBILE]) {
      const verdict = canRoll(
        playing(),
        { reportSubmitted: true, lastRollAt: NOW, lastReportAt: null, now: NOW + 1 },
        rules,
      );
      expect(verdict.allowed, rules.id).toBe(true);
    }
  });
});

describe('formatWait', () => {
  it('says nothing when there is nothing to wait for', () => {
    expect(formatWait(0)).toBe('');
    expect(formatWait(-1)).toBe('');
  });

  it('reads as hours and minutes for a long wait', () => {
    expect(formatWait(ONE_DAY_MS)).toBe('24h 0m');
    expect(formatWait(3 * 3600_000 + 25 * 60_000)).toBe('3h 25m');
  });

  it('reads as minutes and seconds under an hour', () => {
    expect(formatWait(90_000)).toBe('1m 30s');
  });

  it('reads as seconds under a minute', () => {
    expect(formatWait(5_000)).toBe('5s');
  });
});
