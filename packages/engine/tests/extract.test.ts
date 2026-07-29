import { describe, expect, it } from 'vitest';
import { ARROWS, SNAKES, compareToReference, declaresBoard, extractBoards } from '../src';

/** The five shapes the board is written in across the 25 repositories. */
const SHAPES = {
  'object literal': `
    const snakePositions: { [key: number]: number } = { 12: 8, 16: 4 };
    const arrowPositions = { 10: 23, 17: 69 };
  `,

  'array of pairs': `
    const arrowConnections: [number, number][] = [
      [10, 23],
      [17, 69],
    ];
    const snakeConnections: [number, number][] = [
      [12, 8],
      [16, 4],
    ];
  `,

  'switch assigning plan': `
    case plan === 12:
      const obj8 = { count: stepCount, plan: 8, status: 'snake' }
    case plan === 10:
      const obj23 = { count: stepCount, plan: 23, status: 'arrow' }
  `,

  'call carrying the destination': `
    } else if (newPlan === 12) {
      return handleToMove('snakes', updatedPlayer, newPlan, 8, roll)
    } else if (newPlan === 10) {
      return handleToMove('arrows', updatedPlayer, newPlan, 23, roll)
    }
  `,

  'if-chain assigning': `
    if (newPlan == 12) { newPlan = 8; }
    else if (newPlan == 10) { newPlan = 23; }
  `,
};

describe('every shape the board is written in', () => {
  it.each(Object.entries(SHAPES))('reads a board out of a %s', (_name, source) => {
    const board = extractBoards(source);
    expect(board.count).toBeGreaterThanOrEqual(2);
  });

  it.each(Object.entries(SHAPES))('gets the direction right in a %s', (_name, source) => {
    const board = extractBoards(source);
    // 12 → 8 descends and 10 → 23 climbs, in every shape.
    expect(board.snakes[12]).toBe(8);
    expect(board.arrows[10]).toBe(23);
  });

  it('reads the whole reference board out of an object literal', () => {
    const source = `
      const snakes = ${JSON.stringify(SNAKES)};
      const arrows = ${JSON.stringify(ARROWS)};
    `;
    const board = extractBoards(source);
    expect(board.count).toBe(20);
    expect(compareToReference(board.snakes, board.arrows)).toEqual([]);
  });
});

describe('what it does not find', () => {
  it('finds nothing in a file with no board', () => {
    expect(extractBoards('export const greet = (n: string) => `hi ${n}`').count).toBe(0);
  });

  it('does not invent a board from a test that only asserts about one', () => {
    // Mentions every square, declares none of them.
    const test = `
      expect(getDirectionAndPosition(72, false, 2, 70).finalLoka).toBe(51);
      expect(getDirectionAndPosition(12, false, 3, 9).finalLoka).toBe(8);
      expect(validatePosition(72)).toBe(true);
    `;
    expect(declaresBoard(test)).toBe(false);
  });

  it('ignores a jump that goes nowhere', () => {
    expect(extractBoards('if (plan == 5) { plan = 5; }').count).toBe(0);
  });
});

describe('declaresBoard', () => {
  it.each(Object.entries(SHAPES))('recognises a %s as a declaration', (_name, source) => {
    expect(declaresBoard(source)).toBe(true);
  });

  it('says no to a file that merely mentions the numbers', () => {
    expect(declaresBoard('// plan 12 leads to 8, and 10 to 23')).toBe(false);
  });
});

describe('direction is inferred, not assumed, where a source does not name it', () => {
  // Shapes 3 and 5 carry no names. Splitting by direction is safe for a board
  // where snakes descend and arrows climb — and `auditBoard` is what catches a
  // board where that is not true.

  it('files a descending jump as a snake and a climbing one as an arrow', () => {
    const board = extractBoards('if (newPlan == 40) { newPlan = 9; } if (newPlan == 9) { newPlan = 40; }');
    expect(board.snakes[40]).toBe(9);
    expect(board.arrows[9]).toBe(40);
  });

  it('keeps a named source’s own labelling rather than re-deriving it', () => {
    // A wrongly-labelled board must survive extraction so the audit can flag
    // it; silently reclassifying would hide the defect.
    const board = extractBoards('const arrowPositions = { 40: 9 };');
    expect(board.arrows[40]).toBe(9);
    expect(board.snakes[40]).toBeUndefined();
  });
});

describe('the sixth shape, and a false alarm', () => {
  it('reads an array of { from, to } objects, as the Expo tests write it', () => {
    const board = extractBoards(`
      const snakePositions = [
        { from: 12, to: 8 },
        { from: 16, to: 4 },
      ];
      const arrowPositions = [
        { from: 10, to: 23 },
      ];
    `);
    expect(board.snakes[12]).toBe(8);
    expect(board.snakes[16]).toBe(4);
    expect(board.arrows[10]).toBe(23);
  });

  it('does not take an emoji name for a board', () => {
    // `:leftwards_arrow_with_hook:` matched until the pattern was tightened,
    // and reported a profile screen as an unreadable board.
    const source = "iconRight={':leftwards_arrow_with_hook:'}";
    expect(declaresBoard(source)).toBe(false);
    expect(extractBoards(source).count).toBe(0);
  });

  it('still recognises a real collection whose name has a prefix or suffix', () => {
    expect(declaresBoard('const snakePositions = { 12: 8 }')).toBe(true);
    expect(declaresBoard('const arrowConnections: [number, number][] = [[10, 23]]')).toBe(true);
  });
});
