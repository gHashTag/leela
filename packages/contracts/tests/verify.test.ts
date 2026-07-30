import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  ONCHAIN,
  SNAKES,
  TOTAL_PLANS,
  WIN_LOKA,
  auditBoard,
  compareToReference,
  describeProblems,
} from '@leela/engine';
import {
  compareBoards,
  compareConstants,
  describeDivergences,
  parseContract,
} from '../src/verify';

const CONTRACT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'LeelaGame.sol'),
  'utf8',
);

const board = parseContract(CONTRACT);

describe('the contract and the engine agree on the board', () => {
  // This is the whole point of the engine. Twenty `else if` branches in
  // Solidity are a fourth copy of the board, and if they drift an on-chain
  // game plays a different game from the bot, the app and the mini app.

  it('has no divergence at all', () => {
    const divergences = compareBoards(board);
    expect(describeDivergences(divergences)).toBe(
      'the contract and the engine agree on the board',
    );
  });

  it('implements every snake, to the same square', () => {
    for (const [from, to] of Object.entries(SNAKES)) {
      expect(board.jumps.get(Number(from)), `snake ${from}`).toBe(to);
    }
  });

  it('implements every arrow, to the same square', () => {
    for (const [from, to] of Object.entries(ARROWS)) {
      expect(board.jumps.get(Number(from)), `arrow ${from}`).toBe(to);
    }
  });

  it('adds no jump the engine does not have', () => {
    const expected = new Set([...Object.keys(SNAKES), ...Object.keys(ARROWS)].map(Number));
    for (const from of board.jumps.keys()) {
      expect(expected.has(from), `contract jumps from ${from}`).toBe(true);
    }
  });

  it('agrees on the win square and the size of the board', () => {
    expect(compareConstants(board)).toEqual([]);
    expect(board.constants.get('WIN_PLAN')).toBe(WIN_LOKA);
    expect(board.constants.get('TOTAL_PLANS')).toBe(TOTAL_PLANS);
  });
});

describe('parseContract', () => {
  it('finds every jump in the chain', () => {
    // Twenty jumps: ten snakes and ten arrows.
    expect(board.jumps.size).toBe(20);
  });

  it('reads a jump out of a minimal source', () => {
    const { jumps } = parseContract('if (newPlan == 12) { newPlan = 8; }');
    expect(jumps.get(12)).toBe(8);
  });

  it('reads constants regardless of the integer width', () => {
    const { constants } = parseContract(
      'uint8 constant WIN_PLAN = 68;\nuint256 constant OTHER = 3;',
    );
    expect(constants.get('WIN_PLAN')).toBe(68);
    expect(constants.get('OTHER')).toBe(3);
  });

  it('finds nothing in a source with no board, rather than guessing', () => {
    const { jumps, constants } = parseContract('contract Empty {}');
    expect(jumps.size).toBe(0);
    expect(constants.size).toBe(0);
  });
});

describe('compareBoards reports what it finds', () => {
  it('names a jump the contract is missing', () => {
    const missing = parseContract('uint8 constant WIN_PLAN = 68;');
    const divergences = compareBoards(missing);
    expect(divergences.length).toBe(Object.keys(SNAKES).length + Object.keys(ARROWS).length);
    expect(divergences[0].reason).toMatch(/no jump/);
  });

  it('names a jump that goes somewhere else', () => {
    const wrong = parseContract('if (newPlan == 12) { newPlan = 9; }');
    const found = compareBoards(wrong).find((d) => d.from === 12);
    expect(found).toMatchObject({ engine: 8, contract: 9 });
  });

  it('names a jump the engine does not have', () => {
    const extra = parseContract('if (newPlan == 5) { newPlan = 1; }');
    const found = compareBoards(extra).find((d) => d.from === 5);
    expect(found?.reason).toMatch(/treats as ordinary/);
  });

  it('reads as something a person can act on', () => {
    const text = describeDivergences(compareBoards(parseContract('if (newPlan == 12) { newPlan = 9; }')));
    expect(text).toContain('12: engine → 8, contract → 9');
  });
});

describe('the contract enforces the report gate', () => {
  // The contract is the only implementation that ever did. That is the
  // evidence the gate belongs to the game, not to one app's product decisions.

  it('requires a report before a roll', () => {
    expect(CONTRACT).toMatch(/You must create a report before rolling the dice/);
  });

  it('is described by a ruleset that says so', () => {
    expect(ONCHAIN.requireReportBeforeRoll).toBe(true);
    expect(ONCHAIN.id).toBe('onchain');
  });
});

describe('where the contract diverges on the sixes', () => {
  // Both are real differences from `classic`, both are in a deployed contract
  // and therefore permanent. Asserted here so nobody "fixes" the engine to
  // match, or the documentation to disagree.

  it('counts the entering six as the first of a run', () => {
    // `player.consecutiveSixes = 1` on entry; the engine leaves it at 0.
    expect(CONTRACT).toMatch(/player\.consecutiveSixes\s*=\s*1\s*;/);
  });

  it('overwrites the fallback square on every six, not only the first', () => {
    // The engine records it only when a run begins. The contract assigns it
    // unconditionally inside `if (roll == MAX_ROLL)`, so a third six returns
    // the player to where the third six began.
    const sixesBlock = CONTRACT.slice(
      CONTRACT.indexOf('if (roll == MAX_ROLL)'),
      CONTRACT.indexOf('movePlayer(roll, playerAddress);'),
    );
    expect(sixesBlock).toMatch(/positionBeforeThreeSixes\s*=\s*player\.plan\s*;/);
    expect(sixesBlock).not.toMatch(/consecutiveSixes\s*==\s*0\s*\?/);
  });
});

describe('the contract passes the same audit as any other copy', () => {
  // `auditBoard` exists because a fifth copy of the rules turned out to be a
  // different game. The contract is the fourth; it is held to the same check
  // rather than to a bespoke one.

  const snakes: Record<number, number> = {};
  const arrows: Record<number, number> = {};
  for (const [from, to] of board.jumps) {
    (to < from ? snakes : arrows)[from] = to;
  }

  it('is a well formed board on its own terms', () => {
    expect(describeProblems(auditBoard(snakes, arrows))).toBe('no problems found');
  });

  it('is the same board as the engine, jump for jump', () => {
    expect(compareToReference(snakes, arrows)).toEqual([]);
  });

  it('splits into ten snakes and ten arrows, like the reference', () => {
    expect(Object.keys(snakes)).toHaveLength(10);
    expect(Object.keys(arrows)).toHaveLength(10);
  });
});

describe('the constant check can actually fail', () => {
  // compareConstants was only ever asked about the real contract, which agrees.
  // A check that has never returned a divergence has not been shown to detect
  // one — the same argument as the board comparison, which does have that test.

  it('notices a contract that declares no win square', () => {
    const board = parseContract('uint8 constant TOTAL_PLANS = 72;');
    const divergences = compareConstants(board);

    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toMatchObject({ contract: null, engine: WIN_LOKA });
    expect(divergences[0].reason).toContain('declares no WIN_PLAN');
  });

  it('notices a contract that declares no board size', () => {
    const board = parseContract('uint8 constant WIN_PLAN = 68;');
    expect(compareConstants(board)[0].reason).toContain('declares no TOTAL_PLANS');
  });

  it('notices a win square that is not 68', () => {
    const board = parseContract('uint8 constant WIN_PLAN = 67;\nuint8 constant TOTAL_PLANS = 72;');
    const divergences = compareConstants(board);

    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toMatchObject({ engine: WIN_LOKA, contract: 67 });
    expect(divergences[0].reason).toBe('WIN_PLAN differs');
  });

  it('notices a board that is not 72 squares', () => {
    const board = parseContract('uint8 constant WIN_PLAN = 68;\nuint8 constant TOTAL_PLANS = 100;');
    const divergences = compareConstants(board);

    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toMatchObject({ engine: TOTAL_PLANS, contract: 100 });
  });

  it('reports both when both are wrong, rather than stopping at the first', () => {
    const board = parseContract('uint8 constant WIN_PLAN = 50;\nuint8 constant TOTAL_PLANS = 100;');
    expect(compareConstants(board)).toHaveLength(2);
  });

  it('says nothing about the contract that is actually deployed', () => {
    // The point of the four cases above: this one means something now.
    expect(compareConstants(board)).toEqual([]);
  });
});

describe('the report reads for either kind of divergence', () => {
  it('says "nowhere" for a jump the contract does not have', () => {
    const text = describeDivergences(compareBoards(parseContract('uint8 constant WIN_PLAN = 68;')));
    expect(text).toMatch(/contract → nowhere/);
  });

  it('says "nowhere" for a jump the engine does not have', () => {
    // The other side of the same sentence, which had never been printed.
    const text = describeDivergences(compareBoards(parseContract('if (newPlan == 5) { newPlan = 1; }')));
    expect(text).toMatch(/5: engine → nowhere, contract → 1/);
  });
});
