import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  NEUROLEELA,
  RULESETS,
  START_LOKA,
  WIN_LOKA,
  applyRoll,
  initialState,
  isRuleSetId,
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
