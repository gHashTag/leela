import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  GameState,
  RULESETS,
  LEGACY_MOBILE,
  NEUROLEELA,
  ONCHAIN,
  ONE_DAY_MS,
  ONLINE,
  RuleSet,
  WIN_LOKA,
  advance,
  submitReport,
  canCurrentPlayerRoll,
  createSession,
  isSessionOver,
  applyRoll,
  arrivedByJump,
  canRoll,
  formatWait,
  hasWon,
  initialState,
  isWaitingToEnter,
  needsSixToEnter,
  owesReport,
  seededRoller,
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

describe('a throw refused because the player is not on the board', () => {
  /**
   * `isBlocked` covers two different refusals: a throw that would overshoot 72,
   * and a throw by somebody who has not entered the game. A surface that shows
   * one message for both tells a player waiting to enter that they are short of
   * room on a board they have never stood on.
   *
   * Both surfaces worked that out separately and wrote the same three-part
   * condition, and the bot spent a while with the wrong message before copying
   * the mini app's fix — the fourth rule found written out by hand outside the
   * engine in as many passes.
   *
   * The assertion states the rule a different way from the implementation: over
   * every throw a real game makes, a refusal is an entry refusal exactly when
   * the thrower was off the board when they threw. If those two ever come
   * apart, one of them is wrong.
   */
  it('is exactly a refusal by somebody off the board, over played games', () => {
    let seen = 0;

    for (let seed = 1; seed <= 40; seed += 1) {
      let state = initialState();
      const die = seededRoller(seed);

      for (let turn = 0; turn < 200; turn += 1) {
        const before = state;
        const { state: next, event } = applyRoll(state, die(), CLASSIC);
        state = next;

        // `is_finished` alone is not the condition and never was: a winner
        // carries it too. The loop below breaks at the win, so this line read
        // as a pass for as long as the two were conflated.
        expect(needsSixToEnter(event)).toBe(
          event.isBlocked && before.is_finished && !hasWon(before),
        );
        if (needsSixToEnter(event)) seen += 1;

        if (state.is_finished && hasWon(state)) break;
      }
    }

    // And the case occurs, or the assertion above is passing for want of one.
    expect(seen).toBeGreaterThan(0);
  });

  it('is not an overshoot, which is the other refusal', () => {
    // 70 + 5 leaves the board. The player is in play and short of room, which
    // is a different sentence.
    const { event } = applyRoll(playing({ loka: 70, previous_loka: 64 }), 5, CLASSIC);

    expect(event.isBlocked).toBe(true);
    expect(needsSixToEnter(event)).toBe(false);
  });

  it('is a player who has not entered, throwing anything but a six', () => {
    for (const value of [1, 2, 3, 4, 5]) {
      const { event } = applyRoll(initialState(), value, CLASSIC);
      expect(needsSixToEnter(event), `threw ${value}`).toBe(true);
    }
  });

  it('is not a player who has won, whose refusal looks exactly the same', () => {
    // This test used to assert the opposite — "same position, same sentence:
    // on 68, needing a six" — and it was the defect written down as intent.
    // The two states are indistinguishable in the event: both sit on 68 with
    // `is_finished`, and both produce a blocked 68-to-68 throw. So the app told
    // a player who had just reached Cosmic Consciousness that it takes a six to
    // enter the game. The event carries `wasComplete` because nothing else in
    // it can carry the difference.
    const won = applyRoll(playing({ loka: 65 }), 3, CLASSIC).state;
    expect(hasWon(won)).toBe(true);

    const { event } = applyRoll(won, 4, CLASSIC);
    expect(event.isBlocked).toBe(true);
    expect(event.wasComplete).toBe(true);
    expect(needsSixToEnter(event)).toBe(false);
  });

  it('never fires for a completed player, over played games', () => {
    // The rule rather than the one case: whatever the seed, a refusal thrown by
    // somebody who has finished is not an entry refusal.
    let seen = 0;

    for (let seed = 1; seed <= 40; seed += 1) {
      let state = initialState();
      const die = seededRoller(seed);

      for (let turn = 0; turn < 200; turn += 1) {
        const { state: next, event } = applyRoll(state, die(), CLASSIC);
        state = next;
        if (!hasWon(state)) continue;

        // Keep throwing after the win: this is the state the app leaves a
        // finished player in, and the state it used to mis-describe.
        for (const value of [1, 2, 3, 4, 5]) {
          const after = applyRoll(state, value, CLASSIC).event;
          expect(after.isBlocked, `seed ${seed}`).toBe(true);
          expect(needsSixToEnter(after), `seed ${seed} threw ${value}`).toBe(false);
          seen += 1;
        }
        break;
      }
    }

    expect(seen).toBeGreaterThan(0);
  });

  it('is not a throw that moved somebody', () => {
    const { event } = applyRoll(playing({ loka: 11 }), 4, CLASSIC);
    expect(event.isBlocked).toBe(false);
    expect(needsSixToEnter(event)).toBe(false);
  });
});

describe('a player who has not entered the game', () => {
  /**
   * `is_finished` says two things in this shape — the 68 ambiguity, met six
   * times now — and telling them apart takes `hasWon`. Three surfaces were
   * doing it by hand and a fourth was not: `describeStandings` printed the raw
   * square, so a player who had never thrown a six was listed as standing on
   * **68**, the winning square, in the table the bot prints.
   *
   * The assertion is the relation over states a real game reaches, not a list
   * of the two it was got wrong on.
   */

  it('is finished-but-not-won, on every state a game reaches', () => {
    let waiting = 0;
    let playing = 0;

    for (let seed = 1; seed <= 30; seed += 1) {
      let state = initialState();
      const die = seededRoller(seed);

      expect(isWaitingToEnter(state)).toBe(true);
      waiting += 1;

      for (let turn = 0; turn < 150; turn += 1) {
        state = applyRoll(state, die(), CLASSIC).state;

        expect(isWaitingToEnter(state)).toBe(state.is_finished && !hasWon(state));
        if (isWaitingToEnter(state)) waiting += 1;
        else playing += 1;

        if (hasWon(state)) break;
      }
    }

    // Both sides occur, or the relation above is passing for want of examples.
    expect(waiting).toBeGreaterThan(0);
    expect(playing).toBeGreaterThan(0);
  });

  it('is not a winner, who carries the same flag', () => {
    const won = applyRoll(playing({ loka: 65 }), 3, CLASSIC).state;

    expect(won.is_finished).toBe(true);
    expect(hasWon(won)).toBe(true);
    expect(isWaitingToEnter(won)).toBe(false);
  });

  it('is not somebody in play', () => {
    expect(isWaitingToEnter(playing({ loka: 41 }))).toBe(false);
  });

  it('is a player migrated with no history, who has not moved', () => {
    // `stateFromLegacy` sets previous equal to the plan when the export
    // carried none, which reads as "has not moved" — deliberately, so they can
    // still enter.
    expect(isWaitingToEnter(playing({ loka: 68, previous_loka: 68, is_finished: true }))).toBe(
      true,
    );
  });
});

describe('a reason the verdict never gave', () => {
  /**
   * `finished` was declared in `TurnBlockedReason` and returned from nowhere:
   * the only mention of it in this file was the type itself. So every surface
   * wrote the check by hand — the bot's `if (hasWon(player.state)) return
   * { say: 'finished' }`, the mini app's own `canRoll`, the phone's `isOver` —
   * and the phone's asked a different question, `isSessionOver`, which is true
   * only once *everybody* has finished and would have left the die open to a
   * winner at a shared table.
   *
   * A vocabulary with an unreachable word in it is worse than a shorter one. It
   * reads as though the question has been answered here, and three answers get
   * written somewhere else.
   */
  const won = (): GameState => ({
    ...initialState(),
    loka: WIN_LOKA,
    previous_loka: 62,
    is_finished: true,
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
  });

  const context = { reportSubmitted: true, lastRollAt: null, lastReportAt: null, now: 0 };

  it('refuses a player who has won, and says why', () => {
    // `LEGACY_MOBILE` and `ONLINE` are the two that do not let a winner start
    // again; `CLASSIC`, `NEUROLEELA` and `ONCHAIN` do.
    const verdict = canRoll(won(), context, LEGACY_MOBILE);

    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('finished');
  });

  it('allows one who is merely waiting to enter, which carries the same flag', () => {
    // The 68 ambiguity, and the reason this asks `hasWon` rather than
    // `is_finished`: a player who has not entered stands on the winning square
    // with `is_finished` set, and must roll to get off it.
    const verdict = canRoll(initialState(), context, LEGACY_MOBILE);

    expect(verdict.allowed, 'they have to throw a six to begin').toBe(true);
  });

  it('allows a winner under rules that let them start again', () => {
    // `mayReenterAfterWinning` is what the published app does, and the check
    // must not quietly overrule a variant.
    const verdict = canRoll(won(), context, CLASSIC);

    expect(verdict.allowed).toBe(CLASSIC.mayReenterAfterWinning);
  });

  it('gives every reason it declares', () => {
    // The shape, not the case: a word in the vocabulary that nothing can
    // produce is a promise the surfaces end up keeping themselves.
    const reasons = new Set<string>();

    reasons.add(canRoll(won(), context, LEGACY_MOBILE).reason ?? '');
    reasons.add(
      canRoll({ ...initialState(), loka: 6, is_finished: false }, { ...context, reportSubmitted: false }, CLASSIC)
        .reason ?? '',
    );
    // `ONLINE` is the one with a cooldown — a day between throws, counted from
    // the report rather than the roll, which is what the published app does.
    reasons.add(
      canRoll(
        { ...initialState(), loka: 6, is_finished: false },
        { ...context, lastReportAt: 0, now: 1 },
        ONLINE,
      ).reason ?? '',
    );

    expect([...reasons].filter(Boolean).sort()).toEqual([
      'cooldown',
      'finished',
      'report-required',
    ]);
  });
});

describe('the check answers for the act it precedes', () => {
  /**
   * `advance` throws `SessionError` on a finished session, and
   * `canCurrentPlayerRoll` said `allowed` for the same one. `canRoll` is asked
   * about a *player*, and its winner branch is guarded by
   * `mayReenterAfterWinning`, which `classic` sets true — so with one seat,
   * where winning ends the session, the two disagreed.
   *
   * On the phone that was a lit throw button on Cosmic Consciousness and an
   * exception inside the press handler: the last act of a finished game was a
   * crash. Found by playing a game through that app's own functions until it
   * ended, and then asking both questions.
   */
  const playToTheEnd = (rules: RuleSet) => {
    let session = createSession('table', [{ id: 'one', name: 'One' }], rules);
    // A clock the test moves, because two variants make a player wait a day
    // between throws and a fixed `now` would end the game at the first one.
    let clock = 1_700_000_000_000;
    // A cycle of 1..6 in order never lands on 68 exactly; this is a die, not a
    // pattern, and it is the same die on every run.
    let seed = 12_345;
    const die = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return (seed % 6) + 1;
    };

    for (let turn = 0; turn < 4000 && !isSessionOver(session); turn += 1) {
      const verdict = canCurrentPlayerRoll(session, clock);

      if (!verdict.allowed) {
        if (verdict.reason === 'report-required') {
          session = submitReport(session, 'one', clock);
          continue;
        }
        if (verdict.reason === 'cooldown') {
          clock = verdict.nextAllowedAt ?? clock + ONE_DAY_MS;
          continue;
        }
        break;
      }

      session = advance(session, die(), clock).session;
      clock += 1_000;
    }

    return session;
  };

  it.each(Object.values(RULESETS).map((rules) => [rules.id, rules] as const))(
    '%s never says yes to a throw that would throw',
    (_id, rules) => {
      const session = playToTheEnd(rules);
      expect(isSessionOver(session), 'the game reached its end').toBe(true);

      const verdict = canCurrentPlayerRoll(session, 1_800_000_000_000);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('finished');
      expect(() => advance(session, 3, 1_800_000_000_000)).toThrow();
    },
  );

  it('refuses whatever the variant says about beginning again', () => {
    // The rule that made the two disagree. `mayReenterAfterWinning` is about a
    // *player* and this is about a session nobody can move in, so a variant
    // that allows it must still not be told yes here.
    const permissive = Object.values(RULESETS).filter((rules) => rules.mayReenterAfterWinning);
    expect(permissive.length, 'variants that allow it').toBeGreaterThan(0);

    for (const rules of permissive) {
      const session = playToTheEnd(rules);
      expect(canCurrentPlayerRoll(session, 1_800_000_000_000).allowed, rules.id).toBe(false);
    }
  });

  it('still lets a table run while anybody can move', () => {
    // The other half: a session is not over because one seat has finished, and
    // a check that refused there would end a game for everybody at the table.
    const session = createSession('table', [
      { id: 'one', name: 'One' },
      { id: 'two', name: 'Two' },
    ], CLASSIC);

    expect(isSessionOver(session)).toBe(false);
    expect(canCurrentPlayerRoll(session, 1_800_000_000_000).reason).not.toBe('finished');
  });
});
