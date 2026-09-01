import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  SNAKES,
  auditBoard,
  compareRules,
  compareToReference,
  describeProblems,
  detectRules,
} from '../src';

/**
 * The board in `NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` — the
 * fifth copy of the rules, and not Leela at all. Kept verbatim as the worked
 * example of what these checks exist to catch.
 */
const INNGEST_SNAKES = {
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78,
} as const;

const INNGEST_ARROWS = {
  4: 14, 9: 31, 17: 7, 20: 38, 28: 84, 40: 59,
  51: 67, 54: 34, 62: 19, 63: 81, 64: 60, 71: 91,
} as const;

describe('the engine’s own board passes', () => {
  it('has no problems', () => {
    expect(describeProblems(auditBoard(SNAKES, ARROWS))).toBe('no problems found');
  });

  it('matches itself, which is the floor for the comparison to mean anything', () => {
    expect(compareToReference(SNAKES, ARROWS)).toEqual([]);
  });
});

describe('the fifth copy is caught', () => {
  // Not a regression test for one file: it is the worked example that shows
  // these checks catch a board from a different game entirely.

  const problems = auditBoard(INNGEST_SNAKES, INNGEST_ARROWS);
  const findings = new Set(problems.map((p) => p.finding));

  it('is rejected at all', () => {
    expect(problems.length).toBeGreaterThan(0);
  });

  it('names the squares that do not exist on a 72 square board', () => {
    const off = problems.filter((p) => p.finding === 'off-the-board');
    const squares = new Set(off.flatMap((p) => [p.from, p.to]));
    for (const square of [87, 93, 95, 98, 84, 91]) {
      expect(squares.has(square), `square ${square}`).toBe(true);
    }
  });

  it('notices the arrows that go downwards', () => {
    expect(findings.has('wrong-direction')).toBe(true);
    // 17 → 7 and 54 → 34 both descend; in Leela 17 climbs and 54 wins.
    const wrong = problems.filter((p) => p.finding === 'wrong-direction').map((p) => p.from);
    expect(wrong).toContain(17);
    expect(wrong).toContain(54);
  });

  it('notices the squares that are a snake and an arrow at once', () => {
    const both = problems.filter((p) => p.finding === 'both-snake-and-arrow').map((p) => p.from);
    expect(both).toContain(62);
    expect(both).toContain(64);
  });

  it('reads as something a person can act on', () => {
    expect(describeProblems(problems)).toMatch(/off-the-board: .*87/);
  });

  it('shares not one jump with the reference board', () => {
    const differences = compareToReference(INNGEST_SNAKES, INNGEST_ARROWS);

    // Every one of the twenty real jumps is either absent or points elsewhere.
    // Six squares happen to share a number — 16, 17, 20, 28, 54, 62 — which is
    // why counting only the missing ones understates it.
    const accountedFor = differences.filter(
      (d) => d.finding === 'missing' || d.finding === 'different-target',
    );
    expect(accountedFor).toHaveLength(
      Object.keys(SNAKES).length + Object.keys(ARROWS).length,
    );

    expect(differences.some((d) => d.finding === 'extra')).toBe(true);
  });
});

describe('auditBoard catches each shape of wrong board', () => {
  it('a square off the board', () => {
    const [problem] = auditBoard({ 80: 5 }, {});
    expect(problem.finding).toBe('off-the-board');
  });

  it('a snake that climbs', () => {
    expect(auditBoard({ 5: 40 }, {})[0].finding).toBe('wrong-direction');
  });

  it('an arrow that descends', () => {
    expect(auditBoard({}, { 40: 5 })[0].finding).toBe('wrong-direction');
  });

  it('a jump to itself', () => {
    expect(auditBoard({ 5: 5 }, {})[0].finding).toBe('self-loop');
  });

  it('a jump that lands on another jump', () => {
    // 30 → 12, and 12 is itself a snake: one throw would move twice.
    const problems = auditBoard({ 30: 12, 12: 8 }, {});
    expect(problems.some((p) => p.finding === 'chained-jump')).toBe(true);
  });

  it('a second arrow onto the win square', () => {
    const problems = auditBoard({}, { 54: 68, 60: 68 });
    expect(problems.some((p) => p.finding === 'unexpected-win')).toBe(true);
  });

  it('says nothing about an empty board, which is unusual but not wrong', () => {
    expect(auditBoard({}, {})).toEqual([]);
  });
});

describe('compareToReference', () => {
  it('names a jump that is missing', () => {
    const partial = { ...SNAKES } as Record<number, number>;
    delete partial[12];
    const problems = compareToReference(partial, ARROWS);
    expect(problems).toEqual([
      { finding: 'missing', from: 12, to: 8, detail: 'no jump from 12, reference says 12 → 8' },
    ]);
  });

  it('names a jump that goes somewhere else', () => {
    const changed = { ...SNAKES, 12: 9 };
    const [problem] = compareToReference(changed, ARROWS);
    expect(problem).toMatchObject({ finding: 'different-target', from: 12, to: 9 });
    expect(problem.detail).toContain('reference says 8');
  });

  it('names a jump the reference does not have', () => {
    const extra = { ...SNAKES, 40: 2 };
    const problem = compareToReference(extra, ARROWS).find((p) => p.finding === 'extra');
    expect(problem?.from).toBe(40);
  });

  it('reports every difference at once rather than the first', () => {
    expect(compareToReference({}, {}).length).toBe(
      Object.keys(SNAKES).length + Object.keys(ARROWS).length,
    );
  });
});

describe('detecting the rules an implementation carries', () => {
  // The boards mostly agree; the rules do not. ChatBot.tsx has all twenty
  // jumps right and no three-sixes rule at all, which makes it a seventh
  // version of the game rather than a seventh copy of the board.

  it('finds a three-sixes rule in the shapes a player would feel', () => {
    // The rule is that the third six sends the player back — so the check and
    // the move have to be found together. Where they send them differs:
    // a dedicated saved square in most implementations, `previousPlan` in
    // `leela-ai-web3`'s contract. Both are the rule.
    expect(
      detectRules('if (consecutiveSixes === 3) { player.plan = player.positionBeforeThreeSixes; }')
        .threeSixesReset,
    ).toBe(true);
    expect(
      detectRules('if (player.consecutiveSixes == 3) { player.plan = player.previousPlan; }')
        .threeSixesReset,
    ).toBe(true);
    expect(
      detectRules('if (newConsecutive === 3) { return { newPosition: positionBeforeThreeSixes }; }')
        .threeSixesReset,
    ).toBe(true);
  });

  it('does not read counting to three as the rule', () => {
    // `LeelaAiWeb3` counts, prints a message, resets the counter and moves
    // nobody: `positionBeforeThreeSixes` is initialised to 0, sent to a
    // GraphQL mutation, and never read. A counter is not a rule until
    // something happens to the player.
    expect(detectRules('if (consecutiveSixes === 3) { showMessage() }').threeSixesReset).toBe(
      false,
    );
  });

  it('does not read declaring or storing the field as the rule', () => {
    // Three shapes that are not the rule, all of them present in repositories
    // the audit reads: a type, a fixture, and a GraphQL mutation body.
    for (const source of [
      'interface Player { positionBeforeThreeSixes: number }',
      'const player = { consecutiveSixes: 0, positionBeforeThreeSixes: 0 };',
      'mutation { createPlayer { positionBeforeThreeSixes } }',
    ]) {
      expect(detectRules(source).threeSixesReset, source).toBe(false);
    }
  });

  it('reports its absence rather than assuming it', () => {
    const rules = detectRules('const snakes = { 12: 8 }; if (snakes[p]) p = snakes[p];');
    expect(rules.threeSixesReset).toBe(false);
  });

  it('finds the entry-on-six rule in the shapes it is written in', () => {
    expect(detectRules('if (!isStart && rollResult === 6) { plan = 6 }').entryOnSix).toBe(true);
    expect(detectRules('} else if (stepCount === 6 && !isFinished) {').entryOnSix).toBe(true);
  });

  it('finds the refusal to overshoot', () => {
    expect(detectRules('if (newPlan > TOTAL_PLANS) return').refusesOvershoot).toBe(true);
    expect(detectRules('if (newLoka > 72) stay()').refusesOvershoot).toBe(true);
  });

  it('finds the report gate, wherever it is enforced', () => {
    expect(detectRules("require(x, 'You must create a report before rolling the dice.')").reportGate)
      .toBe(true);
    expect(detectRules('if (!isReported) return').reportGate).toBe(true);
  });

  it('finds the unfair die the published app uses', () => {
    expect(
      detectRules('let get = getRandomNumber(); if (get === DiceStore.count) { get = getRandomNumber() }')
        .rerollOnRepeat,
    ).toBe(true);
  });

  it('finds nothing in a file that is not a game', () => {
    const rules = detectRules('export const greet = (name: string) => `hello ${name}`;');
    expect(Object.values(rules).every((value) => value === false)).toBe(true);
  });
});

describe('comparing detected rules against a variant', () => {
  it('says nothing when they match', () => {
    const found = detectRules(
      'if (consecutiveSixes === 3) { plan = positionBeforeThreeSixes } if (newPlan > TOTAL_PLANS) {}',
    );
    expect(compareRules(found, { threeSixesReset: true, refusesOvershoot: true })).toEqual([]);
  });

  it('names a rule that is missing', () => {
    const found = detectRules('const snakes = { 12: 8 }');
    expect(compareRules(found, { threeSixesReset: true })).toEqual([
      { rule: 'threeSixesReset', found: false, expected: true },
    ]);
  });

  it('names a rule that is present and should not be', () => {
    const found = detectRules(
      'if (consecutiveSixes === 3) { player.plan = player.positionBeforeThreeSixes; }',
    );
    expect(compareRules(found, { threeSixesReset: false })).toEqual([
      { rule: 'threeSixesReset', found: true, expected: false },
    ]);
  });

  it('checks only the rules it was asked about', () => {
    const found = detectRules(
      'if (consecutiveSixes === 3) { plan = positionBeforeThreeSixes }',
    );
    expect(compareRules(found, { threeSixesReset: true })).toEqual([]);
  });
});
