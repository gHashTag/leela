/**
 * Auditing a board.
 *
 * The rules have been copied five times across the 25 repositories, and the
 * fifth copy — `NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` — is not
 * Leela at all. Its snakes and arrows are a 100-square Snakes and Ladders set:
 * squares 87, 93, 95, 98, 84 and 91 do not exist on a 72-square board, arrows
 * run downwards, and 62 and 64 appear as both a snake and an arrow.
 *
 * Nothing caught it because nothing checked. This is that check, exported so
 * any implementation — a contract, a port, a generated file — can be held to
 * it rather than trusted.
 */

import { ARROWS, SNAKES, TOTAL_PLANS, WIN_LOKA } from './board';

export type BoardFinding =
  /** A square outside 1..72. */
  | 'off-the-board'
  /** A snake that climbs, or an arrow that descends. */
  | 'wrong-direction'
  /** A square that is both a snake and an arrow. */
  | 'both-snake-and-arrow'
  /** A jump that lands on another jump, which would chain. */
  | 'chained-jump'
  /** A jump that starts and ends on the same square. */
  | 'self-loop'
  /** A jump onto the win square from somewhere other than the one arrow. */
  | 'unexpected-win'
  /** A square the reference board jumps from, and this one does not. */
  | 'missing'
  /** A jump the reference board does not have. */
  | 'extra'
  /** A jump that goes somewhere other than the reference board sends it. */
  | 'different-target';

export interface BoardProblem {
  finding: BoardFinding;
  from: number;
  to: number | null;
  detail: string;
}

export type Jumps = Readonly<Record<number, number>>;

/**
 * Check a board on its own terms, without comparing it to anything.
 *
 * Catches the shape of a wrong board — squares that do not exist, arrows that
 * descend, a square that is both — which is what a copy from another game
 * looks like.
 */
export function auditBoard(snakes: Jumps, arrows: Jumps): BoardProblem[] {
  const problems: BoardProblem[] = [];
  const onBoard = (square: number) =>
    Number.isInteger(square) && square >= 1 && square <= TOTAL_PLANS;

  const check = (jumps: Jumps, kind: 'snake' | 'arrow') => {
    for (const [rawFrom, to] of Object.entries(jumps)) {
      const from = Number(rawFrom);

      if (!onBoard(from) || !onBoard(to)) {
        problems.push({
          finding: 'off-the-board',
          from,
          to,
          detail: `${kind} ${from} → ${to} leaves a ${TOTAL_PLANS} square board`,
        });
        continue;
      }

      if (from === to) {
        problems.push({ finding: 'self-loop', from, to, detail: `${kind} ${from} → ${to}` });
        continue;
      }

      const descends = to < from;
      if ((kind === 'snake') !== descends) {
        problems.push({
          finding: 'wrong-direction',
          from,
          to,
          detail:
            kind === 'snake'
              ? `snake ${from} → ${to} climbs`
              : `arrow ${from} → ${to} descends`,
        });
      }
    }
  };

  check(snakes, 'snake');
  check(arrows, 'arrow');

  for (const from of Object.keys(snakes).map(Number)) {
    if (from in arrows) {
      problems.push({
        finding: 'both-snake-and-arrow',
        from,
        to: null,
        detail: `${from} is a snake and an arrow at once`,
      });
    }
  }

  // A jump landing on another jump would move the player twice from one throw.
  const all: Jumps = { ...snakes, ...arrows };
  for (const [rawFrom, to] of Object.entries(all)) {
    if (to in all) {
      problems.push({
        finding: 'chained-jump',
        from: Number(rawFrom),
        to,
        detail: `${rawFrom} → ${to}, and ${to} jumps again`,
      });
    }
  }

  // Exactly one arrow reaches the win square; any other route to it means a
  // player can win without landing on it.
  const winners = Object.entries(arrows).filter(([, to]) => to === WIN_LOKA);
  if (winners.length > 1) {
    for (const [from, to] of winners.slice(1)) {
      problems.push({
        finding: 'unexpected-win',
        from: Number(from),
        to,
        detail: `${from} → ${WIN_LOKA} is a second way to win by jumping`,
      });
    }
  }

  return problems.sort((a, b) => a.from - b.from);
}

/**
 * Compare a board against this engine's.
 *
 * Use on any implementation that carries its own copy — a contract, a port, a
 * generated file. An empty result means a move lands in the same place
 * everywhere.
 */
export function compareToReference(snakes: Jumps, arrows: Jumps): BoardProblem[] {
  const problems: BoardProblem[] = [];
  const expected = new Map<number, number>([
    ...Object.entries(SNAKES).map(([f, t]) => [Number(f), t] as [number, number]),
    ...Object.entries(ARROWS).map(([f, t]) => [Number(f), t] as [number, number]),
  ]);
  const actual = new Map<number, number>([
    ...Object.entries(snakes).map(([f, t]) => [Number(f), t] as [number, number]),
    ...Object.entries(arrows).map(([f, t]) => [Number(f), t] as [number, number]),
  ]);

  for (const [from, to] of expected) {
    const found = actual.get(from);
    if (found === undefined) {
      problems.push({ finding: 'missing', from, to, detail: `no jump from ${from}` });
    } else if (found !== to) {
      problems.push({
        finding: 'different-target',
        from,
        to: found,
        detail: `${from} → ${found}, reference says ${to}`,
      });
    }
  }

  for (const [from, to] of actual) {
    if (!expected.has(from)) {
      problems.push({ finding: 'extra', from, to, detail: `${from} → ${to} is not on this board` });
    }
  }

  return problems.sort((a, b) => a.from - b.from);
}

/** A summary a person can act on. */
export function describeProblems(problems: BoardProblem[]): string {
  if (problems.length === 0) return 'no problems found';
  return problems.map((p) => `${p.finding}: ${p.detail}`).join('\n');
}

// --- rules, as opposed to the board -----------------------------------------

/**
 * Which rules an implementation appears to carry.
 *
 * The boards mostly agree; the *rules* do not. `ChatBot.tsx` has all twenty
 * jumps right and no three-sixes rule at all, which makes it a seventh version
 * of the game rather than a seventh copy of the board.
 *
 * Detected by reading source, so a false negative is possible — a rule written
 * in some shape this does not recognise. Treated as a prompt to look, not as a
 * verdict.
 */
export interface DetectedRules {
  /** A six is required to enter the game. */
  entryOnSix: boolean;
  /** Three sixes in a row send the player back. */
  threeSixesReset: boolean;
  /** A roll that would overshoot the board is refused. */
  refusesOvershoot: boolean;
  /** Landing exactly on the win square ends the game. */
  winsOnExactLanding: boolean;
  /** A report is required before the next roll. */
  reportGate: boolean;
  /** The die is re-rolled when it repeats. */
  rerollOnRepeat: boolean;
}

export function detectRules(source: string): DetectedRules {
  const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(source));

  return {
    entryOnSix: has(
      /!\s*\w*[Ss]tart\w*\s*&&\s*\w+\s*===?\s*6/,
      /\bstepCount\s*===?\s*6\b/,
      /roll\s*===?\s*(MAX_ROLL|6)[\s\S]{0,200}START_LOKA/,
      /isStart[\s\S]{0,80}===?\s*6/,
    ),
    threeSixesReset: has(
      /consecutive\w*\s*===?\s*3/,
      /consecutive\w*\s*\+=?\s*1[\s\S]{0,200}===?\s*3/,
      /positionBeforeThreeSixes/,
    ),
    refusesOvershoot: has(
      />\s*TOTAL_PLANS/,
      /newPlan\s*>\s*72/,
      /newLoka\s*>\s*(TOTAL_PLANS|72)/,
      /plan\s*>\s*72/,
    ),
    winsOnExactLanding: has(
      /===?\s*(WIN_LOKA|WIN_PLAN)\b/,
      /===?\s*68\b/,
      /plan:\s*68/,
    ),
    reportGate: has(
      /must create a report/i,
      /isReported/,
      /needsReport[\s\S]{0,80}(require|if|return)/,
      /reportSubmitted/,
    ),
    rerollOnRepeat: has(
      /get\s*===?\s*\w*\.count[\s\S]{0,60}getRandomNumber/,
      /if\s*\(\s*\w+\s*===?\s*previous\s*\)/,
    ),
  };
}

/** How two rule sets differ, named so a report can list them. */
export function compareRules(
  found: DetectedRules,
  expected: Partial<DetectedRules>,
): Array<{ rule: keyof DetectedRules; found: boolean; expected: boolean }> {
  const differences: Array<{ rule: keyof DetectedRules; found: boolean; expected: boolean }> = [];

  for (const [rule, want] of Object.entries(expected) as Array<
    [keyof DetectedRules, boolean]
  >) {
    if (found[rule] !== want) differences.push({ rule, found: found[rule], expected: want });
  }

  return differences;
}
