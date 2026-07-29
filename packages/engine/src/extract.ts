/**
 * Reading a board out of somebody else's source.
 *
 * Across the 25 repositories the board is written six different ways. A
 * scanner that knows four of them silently under-reports, which is the failure
 * this whole line of work exists to avoid — so the shapes live here, next to
 * the audit, and are tested rather than trusted.
 */

import type { Jumps } from './audit';

export interface ExtractedBoard {
  snakes: Record<number, number>;
  arrows: Record<number, number>;
  /** How many jumps were found, across both. */
  count: number;
}

/** Split a chain of jumps by direction, for sources that do not name them. */
function byDirection(pairs: Array<[number, number]>): {
  snakes: Record<number, number>;
  arrows: Record<number, number>;
} {
  const snakes: Record<number, number> = {};
  const arrows: Record<number, number> = {};
  for (const [from, to] of pairs) {
    if (from === to) continue;
    (to < from ? snakes : arrows)[from] = to;
  }
  return { snakes, arrows };
}

/**
 * Pull every board out of a source file.
 *
 * Recognises, in the order they appear across the repositories:
 *
 *   1. `const snakePositions = { 12: 8, 16: 4 }` — an object literal
 *   2. `const snakeConnections = [[12, 8], [16, 4]]` — pairs, in the SVG views
 *   3. `const snakePositions = [{ from: 12, to: 8 }]` — the Expo tests
 *   4. `case plan === 12: ... plan: 8` — the published app's switch
 *   5. `else if (newPlan === 12) return handleToMove('snakes', p, n, 8, r)`
 *   6. `if (newPlan == 12) { newPlan = 8; }` — Solidity, and the same in TS
 *
 * Shapes 4 and 6 carry no names, so their direction is inferred. That is safe
 * for a board where every snake descends and every arrow climbs, and
 * `auditBoard` is what catches a board where that is not true.
 */
export function extractBoards(source: string): ExtractedBoard {
  const snakes: Record<number, number> = {};
  const arrows: Record<number, number> = {};

  const add = (kind: 'snake' | 'arrow', jumps: Jumps) => {
    Object.assign(kind === 'snake' ? snakes : arrows, jumps);
  };

  // 1. Object literal, named.
  const literal = /(snake|arrow)\w*\s*(?::[^=]*)?=\s*(?:Object\.freeze\()?\{([^}]*)\}/gi;
  for (const match of source.matchAll(literal)) {
    const jumps: Record<number, number> = {};
    // Keys may be quoted — JSON, and any source that writes `"12": 8`.
    for (const pair of match[2].matchAll(/["']?(\d+)["']?\s*:\s*(\d+)/g)) {
      jumps[Number(pair[1])] = Number(pair[2]);
    }
    if (Object.keys(jumps).length > 0) {
      add(match[1].toLowerCase() as 'snake' | 'arrow', jumps);
    }
  }

  // 2. Array of pairs, named.
  const paired = /(snake|arrow)\w*\s*(?::[^=]*)?=\s*\[([\s\S]*?)\]\s*;/gi;
  for (const match of source.matchAll(paired)) {
    const jumps: Record<number, number> = {};
    for (const pair of match[2].matchAll(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)) {
      jumps[Number(pair[1])] = Number(pair[2]);
    }
    if (Object.keys(jumps).length > 0) {
      add(match[1].toLowerCase() as 'snake' | 'arrow', jumps);
    }
  }

  // 3. Array of `{ from, to }` objects, as the Expo tests write it.
  const objects = /(snake|arrow)\w*\s*(?::[^=]*)?=\s*\[([\s\S]*?)\]\s*;/gi;
  for (const match of source.matchAll(objects)) {
    const jumps: Record<number, number> = {};
    for (const pair of match[2].matchAll(/\{\s*from:\s*(\d+)\s*,\s*to:\s*(\d+)\s*\}/g)) {
      jumps[Number(pair[1])] = Number(pair[2]);
    }
    if (Object.keys(jumps).length > 0) {
      add(match[1].toLowerCase() as 'snake' | 'arrow', jumps);
    }
  }

  // 4. A switch whose cases assign `plan:`.
  const switched =
    /(?:case|if|else if)\s*\(?\s*(?:newPlan|plan)\s*===?\s*(\d+)[^\n]*\n[^\n]*?\bplan:\s*(\d+)/g;
  const cases: Array<[number, number]> = [];
  for (const match of source.matchAll(switched)) {
    cases.push([Number(match[1]), Number(match[2])]);
  }
  if (cases.length > 0) {
    const split = byDirection(cases);
    add('snake', split.snakes);
    add('arrow', split.arrows);
  }

  // 5. A call that names the direction and carries the destination.
  const called =
    /(?:newPlan|plan)\s*===?\s*(\d+)\s*\)[^\n]*\n?[^\n]*?handleToMove\(\s*'(snakes|arrows)'[^,]*,[^,]*,[^,]*,\s*(\d+)/g;
  for (const match of source.matchAll(called)) {
    add(match[2] === 'snakes' ? 'snake' : 'arrow', { [Number(match[1])]: Number(match[3]) });
  }

  // 6. An if-chain that assigns.
  const chain = /(?:newPlan|plan)\s*===?\s*(\d+)\s*\)\s*\{?\s*(?:newPlan|plan)\s*=\s*(\d+)\s*;/g;
  const assigned: Array<[number, number]> = [];
  for (const match of source.matchAll(chain)) {
    assigned.push([Number(match[1]), Number(match[2])]);
  }
  if (assigned.length > 0) {
    const split = byDirection(assigned);
    add('snake', split.snakes);
    add('arrow', split.arrows);
  }

  return {
    snakes,
    arrows,
    count: Object.keys(snakes).length + Object.keys(arrows).length,
  };
}

/**
 * True when a source *declares* a board rather than merely referring to one.
 *
 * A test file full of `expect(getDirectionAndPosition(72, …)).toBe(51)` mentions
 * every square without carrying a board, and reporting it as unreadable would
 * be a false alarm — the scanner should be quiet about files that have nothing
 * to read.
 */
export function declaresBoard(source: string): boolean {
  return (
    // A named collection.
    // A named collection. The name must be a word boundary and the assignment
    // immediate: `:leftwards_arrow_with_hook:` is an emoji, not a board, and
    // matched until this was tightened.
    /\b(snake|arrow)\w*\s*(?::\s*[\w<>[\](), |]*)?=\s*(?:Object\.freeze\()?[[{]/i.test(source) ||
    // An if-chain that assigns.
    /(?:newPlan|plan)\s*===?\s*\d+\s*\)\s*\{?\s*(?:newPlan|plan)\s*=\s*\d+\s*;/.test(source) ||
    // A call that names the direction.
    /handleToMove\(\s*'(snakes|arrows)'/.test(source) ||
    // A switch whose cases build a `plan:` — the published app's shape, which
    // this missed until a test asked.
    /(?:case|if|else if)\s*\(?\s*(?:newPlan|plan)\s*===?\s*\d+[^\n]*\n[^\n]*?\bplan:\s*\d+/.test(source)
  );
}
