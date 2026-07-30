import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  NEUROLEELA,
  ONLINE,
  RULESETS,
  START_LOKA,
  WIN_LOKA,
  applyRoll,
  arrivedOnSix,
  initialState,
  isRuleSetId,
  owesReport,
  ruleSetById,
  type GameState,
  type RuleSet,
} from '../src';

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    loka: 11,
    previous_loka: 5,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
    ...overrides,
  };
}

/** Roll three sixes in a row and report where the player ends up. */
function runOfThreeSixes(rules = NEUROLEELA) {
  let s = playing({ loka: 11 });
  const events = [];
  for (let i = 0; i < 3; i++) {
    const r = applyRoll(s, 6, rules);
    events.push(r.event);
    s = r.state;
  }
  return { state: s, events };
}

describe('rule variants agree on the board', () => {
  it('applies the same snakes and arrows regardless of variant', () => {
    for (const rules of [CLASSIC, NEUROLEELA, LEGACY_MOBILE]) {
      expect(applyRoll(playing({ loka: 10 }), 2, rules).state.loka, rules.id).toBe(8);
      expect(applyRoll(playing({ loka: 18 }), 2, rules).state.loka, rules.id).toBe(32);
      expect(applyRoll(playing({ loka: 53 }), 1, rules).state.loka, rules.id).toBe(WIN_LOKA);
    }
  });

  it('requires a six to enter the game in every variant', () => {
    for (const rules of [CLASSIC, NEUROLEELA, LEGACY_MOBILE]) {
      expect(applyRoll(initialState(), 3, rules).state.loka, rules.id).toBe(WIN_LOKA);
      expect(applyRoll(initialState(), 6, rules).state.loka, rules.id).toBe(START_LOKA);
    }
  });
});

describe('neuroleela — what the Expo app shipped', () => {
  it('burns a run of three sixes', () => {
    const { state, events } = runOfThreeSixes(NEUROLEELA);
    expect(events[2].isThreeSixesReset).toBe(true);
    expect(state.loka).toBe(11);
  });

  it('never grants an extra turn', () => {
    expect(applyRoll(playing(), 6, NEUROLEELA).event.grantsExtraTurn).toBe(false);
  });
});

describe('legacy-mobile — what com.leelagame v6.5.1 shipped', () => {
  it('grants an extra throw on a six', () => {
    expect(applyRoll(playing(), 6, LEGACY_MOBILE).event.grantsExtraTurn).toBe(true);
  });

  it('has no three-sixes rule, so a run just keeps moving', () => {
    const { state, events } = runOfThreeSixes(LEGACY_MOBILE);
    expect(events.every((e) => !e.isThreeSixesReset)).toBe(true);
    // 11 -> 17 (arrow to 69) -> 69+6 overshoots, stays -> stays again.
    expect(state.loka).toBe(69);
  });

  it('does not grant an extra turn on the winning roll', () => {
    // 62 + 6 = 68 exactly: the game ends, so there is nothing to throw for.
    const r = applyRoll(playing({ loka: 62 }), 6, LEGACY_MOBILE);
    expect(r.event.isGameFinished).toBe(true);
    expect(r.event.grantsExtraTurn).toBe(false);
  });
});

describe('classic — the traditional rule, both halves', () => {
  it('grants an extra throw on a six', () => {
    expect(applyRoll(playing(), 6, CLASSIC).event.grantsExtraTurn).toBe(true);
  });

  it('still burns a run of three sixes, and the burning roll ends the turn', () => {
    const { state, events } = runOfThreeSixes(CLASSIC);
    expect(events[0].grantsExtraTurn).toBe(true);
    expect(events[1].grantsExtraTurn).toBe(true);
    expect(events[2].isThreeSixesReset).toBe(true);
    expect(events[2].grantsExtraTurn).toBe(false);
    expect(state.loka).toBe(11);
  });
});

describe('variant metadata', () => {
  it('names each variant so games stay reproducible after a rules change', () => {
    expect(CLASSIC.id).toBe('classic');
    expect(NEUROLEELA.id).toBe('neuroleela');
    expect(LEGACY_MOBILE.id).toBe('legacy-mobile');
  });

  it('records that only the legacy mobile die re-rolls on a repeat', () => {
    expect(LEGACY_MOBILE.rerollOnRepeat).toBe(true);
    expect(CLASSIC.rerollOnRepeat).toBe(false);
    expect(NEUROLEELA.rerollOnRepeat).toBe(false);
  });
});

describe('a variant that does not exist', () => {
  /**
   * `ruleSetById` promised a `RuleSet` and handed back `undefined`.
   *
   * A row in a database with `ruleset` set to something no longer known
   * produced one, and the chat it belonged to then threw on `rules.reports`
   * for every command anyone sent — forever, and three files away from the
   * value that was wrong.
   */
  it('is an error naming what was asked for and what exists', () => {
    expect(() => ruleSetById('neuroleela-v2' as RuleSet['id'])).toThrow(RangeError);
    expect(() => ruleSetById('neuroleela-v2' as RuleSet['id'])).toThrow(/neuroleela-v2/);
    // The message lists the variants, so the next step is obvious.
    for (const id of Object.keys(RULESETS)) {
      expect(() => ruleSetById('nope' as RuleSet['id'])).toThrow(new RegExp(id));
    }
  });

  it('is never silently replaced by classic', () => {
    // Falling back would change the rules of a game already in progress.
    let fell: RuleSet | null = null;
    try {
      fell = ruleSetById('gone' as RuleSet['id']);
    } catch {
      fell = null;
    }
    expect(fell).toBeNull();
  });

  it('is what `isRuleSetId` is for, and it agrees with the table', () => {
    // The assertion is that the two cannot drift: whatever is in RULESETS is
    // exactly what the guard admits.
    for (const id of Object.keys(RULESETS)) {
      expect(isRuleSetId(id), id).toBe(true);
      expect(ruleSetById(id as RuleSet['id']).id).toBe(id);
    }
    for (const not of ['', 'classic ', 'CLASSIC', 'toString', 'constructor', '__proto__']) {
      expect(isRuleSetId(not), not).toBe(false);
    }
  });

  it('does not admit something inherited from Object', () => {
    // `RULESETS[id]` with `id = "toString"` returns a function, which typed as
    // a RuleSet is worse than undefined.
    expect(() => ruleSetById('toString' as RuleSet['id'])).toThrow(RangeError);
  });
});

/**
 * What the published app actually does.
 *
 * `leela/src/store/helper.ts` and `screens/helper.ts` are the two files that
 * decide a move in `com.leelagame`, and three of their rules had never been
 * carried across. They are variants rather than corrections — the boundary in
 * this repository is that behaviour changes through a `RuleSet`, and a live
 * player must not be handed a different game overnight.
 */
describe('a six, in the app that shipped', () => {
  /** A state as if the player had just thrown this value and moved. */
  function afterThrowing(value: number, from = 20, rules = LEGACY_MOBILE): GameState {
    return applyRoll(
      {
        loka: from,
        previous_loka: from - 1,
        direction: 'step 🚶🏼',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: false,
      },
      value,
      rules,
    ).state;
  }

  it('owes no report and starts no day, because createHistory gates on count !== 6', () => {
    // The whole reason the extra turn exists there: a run of sixes is one
    // move, reported once, at the end of it.
    for (const rules of [LEGACY_MOBILE, ONLINE]) {
      expect(owesReport(afterThrowing(6, 20, rules), rules), rules.id).toBe(false);
      expect(owesReport(afterThrowing(3, 20, rules), rules), rules.id).toBe(true);
    }
  });

  it('owes one in the traditional rules, where every arrival is an arrival', () => {
    expect(owesReport(afterThrowing(6, 20, CLASSIC), CLASSIC)).toBe(true);
  });

  it('is recognised from the state alone, which is what the next throw has', () => {
    expect(arrivedOnSix(afterThrowing(6, 20))).toBe(true);
    expect(arrivedOnSix(afterThrowing(4, 20))).toBe(false);
  });

  it('is recognised when it was the six that entered the game', () => {
    // Entering writes a fresh state with no run recorded, and nothing else
    // moves a player off the win square.
    const entered = applyRoll(initialState(), 6, LEGACY_MOBILE).state;
    expect(arrivedOnSix(entered)).toBe(true);
    expect(owesReport(entered, LEGACY_MOBILE)).toBe(false);
    expect(owesReport(entered, CLASSIC)).toBe(true);
  });

  it('owes a report for every variant exactly as its flag says', () => {
    // The shape rather than the four cases: whatever a variant claims about a
    // six is what it does.
    for (const rules of Object.values(RULESETS)) {
      const state = afterThrowing(6, 20, rules);
      // Only meaningful where the six actually moved the player.
      if (state.loka === state.previous_loka) continue;
      expect(owesReport(state, rules), rules.id).toBe(rules.reportAfterSix);
    }
  });
});

describe('a player who has won, in the app that shipped', () => {
  /** A state as the engine leaves it after a win. */
  function won(rules = LEGACY_MOBILE): GameState {
    return applyRoll(
      {
        loka: 67,
        previous_loka: 65,
        direction: 'step 🚶🏼',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: false,
      },
      1,
      rules,
    ).state;
  }

  it('stays finished when a six comes, because the game is over', () => {
    // `stepCount === 6 && !isFinished`: the app will not let a winner back in.
    // Starting another game is what its "Start over" button is for.
    for (const rules of [LEGACY_MOBILE, ONLINE]) {
      const after = applyRoll(won(rules), 6, rules);
      expect(after.state.loka, rules.id).toBe(WIN_LOKA);
      expect(after.state.is_finished).toBe(true);
      expect(after.event.isGameStart).toBe(false);
    }
  });

  it('is let back in by the traditional rules', () => {
    const after = applyRoll(won(CLASSIC), 6, CLASSIC);
    expect(after.state.loka).toBe(START_LOKA);
    expect(after.event.isGameStart).toBe(true);
  });

  it('lets a player who has never played enter under every variant', () => {
    // The flag is about *re-entry*. A fresh player has won nothing, and no
    // variant refuses them.
    for (const rules of Object.values(RULESETS)) {
      const after = applyRoll(initialState(), 6, rules);
      expect(after.state.loka, rules.id).toBe(START_LOKA);
    }
  });
});
