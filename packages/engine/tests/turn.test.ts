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
  arrivedByJump,
  hasWon,
  initialState,
  owesReport,
  seededRoller,
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

  it('is owed for the winning square, which is the point of the whole game', () => {
    // The published app makes exactly one exception to its own six rule:
    // `if (stepCount !== 6 || plan === 68)` navigates to the plan with
    // `report: true`. Cosmic Consciousness is the square a whole game was
    // played to reach, and the gate used to skip it — `is_finished` short-
    // circuited before any of the arrival checks ran.
    const { state } = applyRoll(playing({ loka: 65 }), 3);

    expect(state.loka).toBe(68);
    expect(state.is_finished).toBe(true);
    expect(owesReport(state)).toBe(true);
  });

  it('is owed for a win reached on a six, even where a six owes nothing', () => {
    // `legacy-mobile` asks for no report after a six — and the app asks for one
    // here anyway. That `|| plan === 68` is the whole exception.
    const { state } = applyRoll(playing({ loka: 62 }), 6, LEGACY_MOBILE);

    expect(state.loka).toBe(68);
    expect(owesReport(state, LEGACY_MOBILE)).toBe(true);
  });

  it('is not owed by a player who has not entered the game', () => {
    // The other thing `is_finished` means in this shape. A fresh state carries
    // it, and telling the two apart is what `hasWon` is for.
    expect(owesReport(initialState())).toBe(false);
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

describe('the gate asks whether the player arrived, not whether the square changed', () => {
  /**
   * Those two questions come apart in exactly one place on this board:
   * standing on 8, a four takes you to 12, and the snake at 12 puts you back on
   * 8. The player moved, was bitten and ended where they began — the most
   * eventful turn there is — and the gate used to open as if nothing had
   * happened, handing out a free throw.
   *
   * Both surviving sources of truth disagree. The published app's `entities`
   * returns nothing only when the throw overshoots 72; a snake writes its
   * history and navigates to the plan with `report: true`, comparing no
   * squares. The deployed contract requires a fresh report before every roll
   * once the player is in play, likewise comparing none.
   *
   * The assertion below is not that one square. It is that for every state a
   * real game reaches, the gate agrees with the throw that produced it.
   */

  it('agrees with the event, on every state a real game reaches', () => {
    const rules = CLASSIC;
    let disagreements = 0;
    let jumpsHome = 0;

    for (let seed = 1; seed <= 60; seed += 1) {
      let state = initialState();
      const die = seededRoller(seed);

      for (let turn = 0; turn < 200; turn += 1) {
        const { state: next, event } = applyRoll(state, die(), rules);
        state = next;

        // What the throw did, read off the event rather than off the squares.
        // A win is an arrival — the one the app always asks about — while a
        // player who never entered is not.
        const arrived = !event.isBlocked && (!state.is_finished || hasWon(state));
        if (owesReport(state, rules) !== arrived) disagreements += 1;
        if (arrived && state.loka === state.previous_loka) jumpsHome += 1;

        if (state.is_finished) break;
      }
    }

    expect(disagreements).toBe(0);
    // And the case that made the two questions differ really does occur, or
    // the assertion above would be passing for want of an example.
    expect(jumpsHome).toBeGreaterThan(0);
  });

  it('is owed after a snake carries the player back to where they stood', () => {
    // 8 + 4 = 12, and the snake at 12 returns them to 8.
    const { state } = applyRoll(playing({ loka: 8, previous_loka: 3 }), 4, CLASSIC);

    expect(state.loka).toBe(8);
    expect(state.previous_loka).toBe(8);
    expect(state.direction).toBe('snake 🐍');
    expect(owesReport(state, CLASSIC)).toBe(true);
  });

  it('is not owed after a throw that could not be made', () => {
    // The other side of the same coin, and the reason the square comparison
    // was there: `entities` returns nothing when the throw overshoots 72, so
    // nothing was written and there is nothing to write about.
    const { state, event } = applyRoll(playing({ loka: 70, previous_loka: 64 }), 5, CLASSIC);

    expect(event.isBlocked).toBe(true);
    expect(state.loka).toBe(state.previous_loka);
    expect(owesReport(state, CLASSIC)).toBe(false);
  });

  it('tells an arrival apart from a refusal by the direction, not the square', () => {
    // Both have `loka === previous_loka`. Only one of them is a turn that
    // happened.
    expect(arrivedByJump(playing({ loka: 8, previous_loka: 8, direction: 'snake 🐍' }))).toBe(true);
    expect(arrivedByJump(playing({ loka: 8, previous_loka: 8, direction: 'arrow 🏹' }))).toBe(true);
    expect(arrivedByJump(playing({ loka: 8, previous_loka: 8, direction: 'stop 🛑' }))).toBe(false);
    expect(arrivedByJump(playing({ loka: 8, previous_loka: 8, direction: 'step 🚶🏼' }))).toBe(false);
  });

  it('is not a jump home when the square did change', () => {
    // A snake that actually moves the player is an ordinary arrival, caught by
    // the square comparison; this helper is only about the case it misses.
    expect(arrivedByJump(playing({ loka: 8, previous_loka: 12, direction: 'snake 🐍' }))).toBe(false);
  });

  it('says nothing is owed by a player who has not started', () => {
    // `is_finished` with `previous_loka: 0` is the waiting state, not a win.
    expect(owesReport(initialState(), CLASSIC)).toBe(false);
  });
});
