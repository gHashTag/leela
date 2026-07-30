/**
 * Checking the contract against the engine, without an EVM.
 *
 * `LeelaGame.sol` is a fourth copy of the board — twenty `else if` branches
 * that must agree with `SNAKES` and `ARROWS` or an on-chain game plays a
 * different game from every other surface. A deployed contract cannot be
 * corrected, so the value here is knowing precisely where it agrees and where
 * it does not.
 *
 * This reads the source rather than running it: a full Hardhat toolchain to
 * assert twenty numbers would be a heavy way to learn very little.
 */

import { ARROWS, SNAKES, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';

export interface ContractBoard {
  /** `newPlan == X` → `newPlan = Y`, in source order. */
  jumps: Map<number, number>;
  /** Constants declared at the top of the contract. */
  constants: Map<string, number>;
}

/**
 * Read the board out of the Solidity source.
 *
 * Matches the `if (newPlan == 12) { newPlan = 8; }` chain that both the snake
 * and arrow blocks are written as.
 */
export function parseContract(source: string): ContractBoard {
  const jumps = new Map<number, number>();
  const constants = new Map<string, number>();

  for (const [, name, value] of source.matchAll(/uint\d*\s+constant\s+(\w+)\s*=\s*(\d+)/g)) {
    if (name !== undefined) constants.set(name, Number(value));
  }

  // `newPlan == 12` ... `newPlan = 8` — the assignment is the next one after
  // the comparison, so pair them up in order rather than by nesting.
  const pattern = /newPlan\s*==\s*(\d+)\s*\)\s*\{\s*newPlan\s*=\s*(\d+)\s*;/g;
  for (const match of source.matchAll(pattern)) {
    jumps.set(Number(match[1]), Number(match[2]));
  }

  return { jumps, constants };
}

export interface Divergence {
  /** The square the two disagree about. */
  from: number;
  /** Where the engine sends a player, or null when it sends them nowhere. */
  engine: number | null;
  /** Where the contract sends them, or null. */
  contract: number | null;
  reason: string;
}

/**
 * Every square where the contract and the engine disagree.
 *
 * An empty result means an on-chain move lands where every other surface would
 * put it — which is the only thing that makes the engine a single source of
 * truth rather than one implementation among four.
 */
export function compareBoards(board: ContractBoard): Divergence[] {
  const divergences: Divergence[] = [];
  const expected = new Map<number, number>([
    ...Object.entries(SNAKES).map(([from, to]) => [Number(from), to] as [number, number]),
    ...Object.entries(ARROWS).map(([from, to]) => [Number(from), to] as [number, number]),
  ]);

  for (const [from, to] of expected) {
    const onchain = board.jumps.get(from);
    if (onchain === undefined) {
      divergences.push({
        from,
        engine: to,
        contract: null,
        reason: 'the contract has no jump from this square',
      });
    } else if (onchain !== to) {
      divergences.push({
        from,
        engine: to,
        contract: onchain,
        reason: 'the two send a player to different squares',
      });
    }
  }

  for (const [from, to] of board.jumps) {
    if (!expected.has(from)) {
      divergences.push({
        from,
        engine: null,
        contract: to,
        reason: 'the contract jumps from a square the engine treats as ordinary',
      });
    }
  }

  return divergences.sort((a, b) => a.from - b.from);
}

/** Constants the contract must agree on, or its arithmetic means something else. */
export function compareConstants(board: ContractBoard): Divergence[] {
  const divergences: Divergence[] = [];

  const expected: Array<[string, number]> = [
    ['WIN_PLAN', WIN_LOKA],
    ['TOTAL_PLANS', TOTAL_PLANS],
  ];

  for (const [name, value] of expected) {
    const found = board.constants.get(name);
    if (found === undefined) {
      divergences.push({
        from: value,
        engine: value,
        contract: null,
        reason: `the contract declares no ${name}`,
      });
    } else if (found !== value) {
      divergences.push({
        from: value,
        engine: value,
        contract: found,
        reason: `${name} differs`,
      });
    }
  }

  return divergences;
}

/** A one-line summary, for a build log. */
export function describeDivergences(divergences: Divergence[]): string {
  if (divergences.length === 0) return 'the contract and the engine agree on the board';

  return divergences
    .map((d) => `${d.from}: engine → ${d.engine ?? 'nowhere'}, contract → ${d.contract ?? 'nowhere'} (${d.reason})`)
    .join('\n');
}
