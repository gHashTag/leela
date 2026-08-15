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

import { ARROWS, SIXES_TO_RESET, SNAKES, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';

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

/**
 * A one-line summary, for a build log.
 *
 * `subject` is what was compared, and it is an argument rather than the word
 * *board* because this function had that word written into it. The sixes
 * comparison prints through here too, and an empty result from it announced
 * *the contract and the engine agree on the board* — a sentence about twenty
 * jumps nobody had looked at, printed by a check that had looked at a rule
 * about dice. Naming the subject at the call site is the whole repair; it is
 * required, not defaulted, because a default is how the wrong word got here.
 */
export function describeDivergences(divergences: Divergence[], subject: string): string {
  if (divergences.length === 0) return `the contract and the engine agree on ${subject}`;

  return divergences
    .map((d) => `${d.from}: engine → ${d.engine ?? 'nowhere'}, contract → ${d.contract ?? 'nowhere'} (${d.reason})`)
    .join('\n');
}

/**
 * The run of sixes, read out of the Solidity rather than described beside it.
 *
 * `ONCHAIN` exists because the contract counts a run differently, and both
 * differences were written in prose — in the rule set's own comment and in
 * `contracts/README.md` — while the board twenty lines above them is parsed
 * from this same source and asserted. A hand-written list beside a computable
 * one is the shape this repository keeps finding, and here it sat next to the
 * machine that would have computed it.
 *
 * Reading it also says more than the prose did. *A third six returns the player
 * to where the third six began rather than the first* is true and understates
 * what happens: `positionBeforeThreeSixes` is assigned `player.plan` at the top
 * of the same call that then assigns it back, so **the reset cannot move
 * anybody**. It costs the throw and leaves the player standing where they were.
 * The engine under `threeSixesReset` walks them back to where the run began —
 * from plan 14 to plan 6 in a run started on the entering six.
 */
/**
 * Which of the three things the reading rests on were actually found.
 *
 * The five answers below are spread across three places in the Solidity — the
 * branch that enters the game with a six, the branch a six takes afterwards,
 * and the `if` inside that one which fires the reset — and until this existed,
 * *I could not find it* and *the contract does not do it* were the same
 * sentence. `parseSixes` returned `resetsAt: null` and four `false`s for a
 * source it had understood nothing of, which is exactly the record a lawful
 * contract-without-the-rule produces, and `compareSixes` gates every branch
 * after the first on `resetsAt !== null`. So a source the parser went blind on
 * came back through `describeDivergences` as agreement.
 *
 * The sharp case is a rename that changes no Solidity behaviour at all.
 * `roll == MAX_ROLL` written as `roll == 6` is the same comparison — the
 * constant is 6 — and it took the `onSix` regex out, which silently deleted
 * one of the two genuine divergences this module exists to report.
 */
export interface SixesBranchesRead {
  /** `if (!player.isStart && rollResult == 6)`, the six that enters the game. */
  entry: boolean;
  /** `if (roll == MAX_ROLL) { … } else {`, the branch a six takes. */
  six: boolean;
  /**
   * The `if` inside the six branch that fires the reset.
   *
   * True when it was read, and also true when the six branch compares the run
   * length nowhere at all — that is a contract with no three-sixes rule, which
   * is a lawful variant rather than a failure to read. False only for the
   * middle case: the run length *is* compared, in a form this reader does not
   * understand. `player.consecutiveSixes >= 3` is that case, and on a counter
   * that only ever rises by one it is the same rule written differently.
   */
  reset: boolean;
}

export interface ContractSixes {
  /** The six that enters the game sets the run to this. Null if it sets none. */
  runAfterEntry: number | null;
  /** `positionBeforeThreeSixes` is written on every six, not only the first. */
  fallbackWrittenOnEverySix: boolean;
  /** The run length the reset fires on. Null if nothing resets. */
  resetsAt: number | null;
  /** The reset sends the player to the square the same call recorded. */
  resetReturnsToFallback: boolean;
  /** The reset returns without moving, so the throw is spent and nothing else. */
  resetSkipsTheMove: boolean;
  /**
   * What the parser could see, when this record came from a parser.
   *
   * Absent means the record was stated by hand: a test or a caller describing a
   * contract it has already read is making a claim, not reporting a reading,
   * and treating its silence as an unreadable source would turn every such
   * record into a divergence. `parseSixes` always fills it in. A second reader
   * of Solidity that did not would put the defect above straight back, so this
   * is the one field a new parser must not forget.
   */
  branchesRead?: SixesBranchesRead;
}

/**
 * Read how the contract keeps a run of sixes.
 *
 * Source, not an EVM, for the reason `parseContract` gives: a Hardhat toolchain
 * to learn five facts would be a heavy way to learn very little.
 */
export function parseSixes(source: string): ContractSixes {
  const entry = /!player\.isStart\s*&&\s*rollResult\s*==\s*6\s*\)\s*\{[\s\S]*?\}/.exec(source)?.[0];
  const runAfterEntry = entry
    ? Number(/player\.consecutiveSixes\s*=\s*(\d+)\s*;/.exec(entry)?.[1] ?? Number.NaN)
    : Number.NaN;

  // The branch a six takes, up to the `else` that clears the run.
  const sixBranch = /if\s*\(\s*roll\s*==\s*MAX_ROLL\s*\)\s*\{([\s\S]*?)\n\s*\}\s*else\s*\{/.exec(source);
  const onSix = sixBranch?.[1] ?? '';

  const reset = /if\s*\(\s*player\.consecutiveSixes\s*==\s*(\d+)\s*\)\s*\{([\s\S]*?)\n\s*\}/.exec(onSix);

  // Whether the six branch weighs the run length at all. `+= 1` and `= 0` are
  // not comparisons and must not count, or every contract would look unread.
  const comparesTheRun = /player\.consecutiveSixes\s*(?:==|!=|>=|<=|>|<)/.test(onSix);

  return {
    runAfterEntry: Number.isNaN(runAfterEntry) ? null : runAfterEntry,
    // Written unconditionally inside the six branch: no `if` between the branch
    // opening and the assignment.
    fallbackWrittenOnEverySix:
      /^[\s\S]*?player\.positionBeforeThreeSixes\s*=\s*player\.plan\s*;/.test(onSix) &&
      !/if[\s\S]*?player\.positionBeforeThreeSixes\s*=\s*player\.plan\s*;/.test(onSix),
    resetsAt: reset ? Number(reset[1]) : null,
    resetReturnsToFallback: /player\.plan\s*=\s*player\.positionBeforeThreeSixes\s*;/.test(reset?.[2] ?? ''),
    resetSkipsTheMove: /\breturn\s*;/.test(reset?.[2] ?? ''),
    branchesRead: {
      entry: entry !== undefined,
      six: sixBranch !== null,
      reset: reset !== null || !comparesTheRun,
    },
  };
}

/**
 * What the contract does with a run of sixes that the engine does not.
 *
 * `from` is the run length each difference is about, so the list reads in the
 * order a player would meet them.
 */
export function compareSixes(sixes: ContractSixes): Divergence[] {
  const divergences: Divergence[] = [];

  // What could not be read comes first, because everything below it is then a
  // statement about a source that was never understood. `from` is 0 for these:
  // the other entries carry the run length they are about, and a reading that
  // did not happen is about no run length at all.
  //
  // Each of the three is reported separately rather than as one "unreadable",
  // because they cost different amounts. Losing the six branch loses four of
  // the five answers; losing the entry branch loses one; losing the reset `if`
  // loses three of the four inside the six branch. A caller that has to decide
  // whether to trust the rest needs to know which.
  const read = sixes.branchesRead;

  if (read !== undefined && !read.six) {
    divergences.push({
      from: 0,
      engine: null,
      contract: null,
      reason:
        "the contract's six branch could not be read, so nothing about the run of sixes was checked",
    });
  }

  if (read !== undefined && !read.entry) {
    divergences.push({
      from: 0,
      engine: null,
      contract: null,
      reason:
        'the branch that enters the game with a six could not be read, so nothing about how a run begins was checked',
    });
  }

  if (read !== undefined && !read.reset) {
    divergences.push({
      from: 0,
      engine: null,
      contract: null,
      reason:
        'the six branch weighs the run length in a form this reader does not understand, so nothing about the reset was checked',
    });
  }

  // The engine enters the game with no run: `initialState` starts at zero and
  // the entering six is the arrival, not the first of three.
  if (sixes.runAfterEntry !== null && sixes.runAfterEntry !== 0) {
    divergences.push({
      from: 1,
      engine: 0,
      contract: sixes.runAfterEntry,
      reason: 'the six that enters the game is counted as the first of a run, so the reset comes a throw sooner',
    });
  }

  if (sixes.fallbackWrittenOnEverySix) {
    divergences.push({
      from: sixes.resetsAt ?? SIXES_TO_RESET,
      engine: null,
      contract: null,
      reason:
        'the fallback square is overwritten on every six, so the reset returns the player to where they already stand and cannot move them',
    });
  }

  if (sixes.resetsAt !== null && sixes.resetsAt !== SIXES_TO_RESET) {
    divergences.push({
      from: sixes.resetsAt,
      engine: SIXES_TO_RESET,
      contract: sixes.resetsAt,
      reason: 'the reset fires on a different run length',
    });
  }

  // The two fields nothing read. `parseSixes` had answered both since it was
  // written and this comparer, which owns them, asked neither — so the shape
  // that found the sixth divergent game was computed and thrown away.
  //
  // `LeelaAiWeb3` resets the counter, prints a message, and moves nobody: a
  // rule present in every way a reader can see, and inert. A run length and a
  // fallback square are the setup; whether the player is sent back is the rule.
  if (sixes.resetsAt !== null && !sixes.resetReturnsToFallback) {
    divergences.push({
      from: sixes.resetsAt,
      engine: 0,
      contract: null,
      reason:
        'the reset counts the run and does not send the player back, so the rule is present and inert',
    });
  }

  // And having sent them back, the throw must be spent. A reset that falls
  // through into the move applies the six as well, so the player is returned
  // and then walked six squares from there — further on than standing still.
  if (sixes.resetsAt !== null && sixes.resetReturnsToFallback && !sixes.resetSkipsTheMove) {
    divergences.push({
      from: sixes.resetsAt,
      engine: 0,
      contract: null,
      reason: 'the reset sends the player back and then moves them, so the throw is spent twice',
    });
  }

  return divergences;
}
