/**
 * The run of sixes, read out of the contract instead of described beside it.
 *
 * `ONCHAIN` exists because the deployed contract counts a run differently from
 * every other surface, and both differences were written in prose — in the rule
 * set's own comment and in `contracts/README.md` — while the board twenty lines
 * above them is parsed from this same file and asserted against the engine. A
 * hand-written list beside a computable one is the shape this repository keeps
 * meeting, and this one sat next to the machine that would have computed it.
 *
 * Reading it says more than the prose did. *A third six returns the player to
 * where the third six began rather than the first* is true, and understates it:
 * `positionBeforeThreeSixes` is assigned `player.plan` at the top of the same
 * call that assigns it back, so the on-chain reset **cannot move anybody**. It
 * spends the throw and leaves the player standing where they were. Played
 * through the engine under `ONCHAIN`, the same four sixes walk a player from
 * plan 14 back to plan 6.
 *
 * These assert that the reading is a reading. Every fact is checked against a
 * source edited to say something else — a parser that returned constants would
 * pass the first half of this file and fail every mutation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ONCHAIN, SIXES_TO_RESET, applyRoll, initialState, type GameState } from '@leela/engine';
import {
  compareSixes,
  describeDivergences,
  parseSixes,
  type ContractSixes,
  type SixesBranchesRead,
} from '../src/verify';

const CONTRACT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'LeelaGame.sol'),
  'utf8',
);

/** The same contract with one line saying something else. */
const edited = (from: string | RegExp, to: string) => {
  const changed = CONTRACT.replace(from, to);
  expect(changed, 'the edit has to actually change the source').not.toBe(CONTRACT);
  return changed;
};

describe('what the contract does with a run of sixes', () => {
  it('is read from the contract, not written beside it', () => {
    expect(parseSixes(CONTRACT)).toEqual({
      runAfterEntry: 1,
      fallbackWrittenOnEverySix: true,
      resetsAt: SIXES_TO_RESET,
      resetReturnsToFallback: true,
      resetSkipsTheMove: true,
      branchesRead: { entry: true, six: true, reset: true },
    });
  });

  it('follows the entering six wherever the contract puts it', () => {
    expect(parseSixes(edited('player.consecutiveSixes = 1;', 'player.consecutiveSixes = 0;')).runAfterEntry).toBe(0);
    expect(parseSixes(edited('player.consecutiveSixes = 1;', 'player.consecutiveSixes = 2;')).runAfterEntry).toBe(2);
  });

  it('follows the run length the reset fires on', () => {
    const later = edited('player.consecutiveSixes == 3', 'player.consecutiveSixes == 4');
    expect(parseSixes(later).resetsAt).toBe(4);
  });

  it('sees a fallback square that is kept rather than overwritten', () => {
    // The repair somebody would make: record where the run began, once.
    const once = edited(
      'player.positionBeforeThreeSixes = player.plan;',
      'if (player.consecutiveSixes == 0) { player.positionBeforeThreeSixes = player.plan; }',
    );

    expect(parseSixes(once).fallbackWrittenOnEverySix).toBe(false);
    expect(parseSixes(CONTRACT).fallbackWrittenOnEverySix).toBe(true);
  });

  it('sees a reset that moves the player and one that only spends the throw', () => {
    const moves = edited(/player\.plan = player\.positionBeforeThreeSixes;\n(\s*)player\.consecutiveSixes = 0;\n\s*return;/, 'player.plan = 6;\n$1player.consecutiveSixes = 0;');

    expect(parseSixes(moves).resetReturnsToFallback).toBe(false);
    expect(parseSixes(moves).resetSkipsTheMove).toBe(false);
  });
});

describe('where the contract and the engine part company', () => {
  it('names both differences, computed rather than remembered', () => {
    const reasons = compareSixes(parseSixes(CONTRACT)).map((one) => one.reason);

    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('the six that enters the game is counted as the first of a run');
    expect(reasons[1]).toContain('cannot move them');
  });

  it('says nothing about a contract that agrees', () => {
    // The list is empty when there is nothing to say. A description that always
    // has two entries in it is not a comparison.
    expect(
      compareSixes({
        runAfterEntry: 0,
        fallbackWrittenOnEverySix: false,
        resetsAt: SIXES_TO_RESET,
        // Both as the vendored contract has them. These two carried arbitrary
        // values while nothing read them, and `false` here described a reset
        // that sends the player back and then walks them six squares on.
        resetReturnsToFallback: true,
        resetSkipsTheMove: true,
      }),
    ).toEqual([]);
  });

  it('notices a reset that fires on a different run length', () => {
    const divergences = compareSixes({
      runAfterEntry: 0,
      fallbackWrittenOnEverySix: false,
      resetsAt: 4,
      resetReturnsToFallback: true,
      resetSkipsTheMove: true,
    });

    expect(divergences.map((one) => one.reason)).toEqual([
      'the reset fires on a different run length',
    ]);
  });
});

describe('the difference a player would feel', () => {
  it('is a reset that moves them, where the contract leaves them standing', () => {
    // The engine under `ONCHAIN`, four sixes from the start. The contract's own
    // arithmetic is in the parse above: the fallback is this call's own square,
    // so `plan = positionBeforeThreeSixes` is `plan = plan`.
    let state: GameState = initialState();
    const walked: number[] = [];

    for (let throws = 0; throws < 4; throws += 1) {
      state = applyRoll(state, 6, ONCHAIN).state;
      walked.push(state.loka);
    }

    // The fourth six is the engine's third of a run — the entering six does not
    // count — and it walks the player back to where the run began.
    expect(walked[3]).toBe(6);
    expect(walked[3]).toBeLessThan(walked[2] as number);

    // And the contract cannot do this at all, whatever square it happens on.
    const sixes = parseSixes(CONTRACT);
    expect(sixes.fallbackWrittenOnEverySix && sixes.resetReturnsToFallback).toBe(true);
  });
});

describe('a rule that is present and does nothing', () => {
  /**
   * The two fields `parseSixes` had always answered and `compareSixes` had
   * never asked. Nothing read them, so the audit reported them as written and
   * never read, and the shape they describe is the one that found the sixth
   * divergent game: `LeelaAiWeb3` counts the run, prints a message, resets the
   * counter, and moves nobody.
   *
   * Asserted over the shape rather than over that donor: for every combination
   * of the two answers, a reset that does not send the player back diverges,
   * and one that sends them back and then moves them diverges too. Only the
   * pair the contract actually has is silent.
   */
  const shapes = [
    { returns: true, skips: true, expected: 0 },
    { returns: false, skips: true, expected: 1 },
    { returns: false, skips: false, expected: 1 },
    { returns: true, skips: false, expected: 1 },
  ];

  for (const { returns, skips, expected } of shapes) {
    it(`says ${expected} about a reset that ${returns ? 'returns' : 'does not return'} and ${skips ? 'skips' : 'does not skip'} the move`, () => {
      const divergences = compareSixes({
        runAfterEntry: 0,
        fallbackWrittenOnEverySix: false,
        resetsAt: SIXES_TO_RESET,
        resetReturnsToFallback: returns,
        resetSkipsTheMove: skips,
      });

      expect(divergences).toHaveLength(expected);
    });
  }

  it('says nothing about either when no rule resets at all', () => {
    // A contract with no three-sixes rule is a variant, not an inert rule, and
    // reporting it here would name the wrong defect.
    expect(
      compareSixes({
        runAfterEntry: 0,
        fallbackWrittenOnEverySix: false,
        resetsAt: null,
        resetReturnsToFallback: false,
        resetSkipsTheMove: false,
      }),
    ).toEqual([]);
  });

  it('says neither of these two about the contract this repository vendors', () => {
    // The vendored contract diverges on two counts already recorded — it counts
    // the entering six, and it overwrites the fallback on every six. Neither of
    // the two branches added here is about those, and asserting the whole list
    // is empty would have been asserting the wrong thing: the contract does
    // send the player back, and does spend the throw doing it.
    const reasons = compareSixes(parseSixes(CONTRACT)).map((one) => one.reason);

    expect(reasons.some((one) => one.includes('present and inert'))).toBe(false);
    expect(reasons.some((one) => one.includes('spent twice'))).toBe(false);
  });
});

describe('a contract this reader could not read', () => {
  /**
   * The half of this module that answered *nothing is wrong* about a source it
   * had understood nothing of.
   *
   * `compareSixes(parseSixes('contract Empty {}'))` returned `[]`, and `[]`
   * through `describeDivergences` was the sentence *the contract and the engine
   * agree*. Every answer `parseSixes` gives is a regex over Solidity, and a
   * regex that does not match returns the same record a lawful
   * contract-without-the-rule produces: `resetsAt: null` and four `false`s. The
   * other half of this same module fails loudly on the same absence — an empty
   * source makes `compareBoards` name all twenty squares — so the two halves
   * disagreed about what an absence means.
   *
   * The sharp case is a rename that changes no Solidity behaviour whatever.
   * `MAX_ROLL` is 6, so `roll == MAX_ROLL` and `roll == 6` are one comparison,
   * and writing the second took the `onSix` regex out and silently deleted the
   * *fallback overwritten on every six* finding this module spends a paragraph
   * on. `player.consecutiveSixes >= 3` is the same trick one level down: on a
   * counter that only ever rises by one it is the same rule, and it takes the
   * reset regex out.
   *
   * So the grid takes away each thing the parse rests on in turn — including
   * two ways that are no-ops in Solidity — and asks the same question of every
   * row. It is not a list of the three known blindings: the count of readings
   * that did not happen is read off `branchesRead`, and the number of
   * divergences the readability state adds is measured by running the same
   * record twice, once with `branchesRead` and once without. Without it is
   * precisely the old behaviour, so every row also states what used to be lost.
   */
  const withoutTheReading = (sixes: ContractSixes): ContractSixes => {
    const stated = { ...sixes };
    delete stated.branchesRead;
    return stated;
  };

  const grid: Array<{ what: string; source: string; reads: SixesBranchesRead }> = [
    {
      what: 'nothing at all',
      source: '',
      reads: { entry: false, six: false, reset: true },
    },
    {
      what: 'a contract with no body',
      source: 'contract Empty {}',
      reads: { entry: false, six: false, reset: true },
    },
    {
      what: 'the entering six spelled with the constant, which is the same six',
      source: CONTRACT.replace('rollResult == 6', 'rollResult == MAX_ROLL'),
      reads: { entry: false, six: true, reset: true },
    },
    {
      what: 'the entry branch gone',
      source: CONTRACT.replace('if (!player.isStart && rollResult == 6) {', 'if (false) {'),
      reads: { entry: false, six: true, reset: true },
    },
    {
      what: 'the six branch spelled with the literal, which is the same six',
      source: CONTRACT.replace('roll == MAX_ROLL', 'roll == 6'),
      reads: { entry: true, six: false, reset: true },
    },
    {
      what: 'the six branch gone',
      source: CONTRACT.replace('if (roll == MAX_ROLL) {', 'if (false) {'),
      reads: { entry: true, six: false, reset: true },
    },
    {
      what: 'the reset written as a threshold, which on this counter is the same rule',
      source: CONTRACT.replace('player.consecutiveSixes == 3', 'player.consecutiveSixes >= 3'),
      reads: { entry: true, six: true, reset: false },
    },
    {
      what: 'both branches spelled the other way at once',
      source: CONTRACT.replace('rollResult == 6', 'rollResult == MAX_ROLL').replace(
        'roll == MAX_ROLL',
        'roll == 6',
      ),
      reads: { entry: false, six: false, reset: true },
    },
    {
      // The one row where nothing went blind: the rule is genuinely absent.
      // A check that called this unreadable would be crying wolf on a lawful
      // variant, and a variant reported as a defect is a check people delete.
      what: 'the three-sixes rule deleted outright, which is a variant and not a blindness',
      source: CONTRACT.replace(
        / {6}if \(player\.consecutiveSixes == 3\) \{[\s\S]*?\n {6}\}\n/,
        '',
      ),
      reads: { entry: true, six: true, reset: true },
    },
  ];

  for (const { what, source, reads } of grid) {
    it(`is not agreement, given ${what}`, () => {
      expect(source, 'the row has to actually change the source').not.toBe(CONTRACT);

      const sixes = parseSixes(source);
      expect(sixes.branchesRead, 'what the parser could see').toEqual(reads);

      const unread = Object.values(reads).filter((could) => !could).length;
      const divergences = compareSixes(sixes);

      // Exactly one divergence per reading that did not happen, measured
      // against the same record with the readability state taken away.
      expect(divergences.length - compareSixes(withoutTheReading(sixes)).length).toBe(unread);

      if (unread > 0) {
        expect(divergences).not.toHaveLength(0);
        expect(describeDivergences(divergences, 'the run of sixes')).not.toContain('agree');
      }
    });
  }

  it('loses no genuine finding to a rename that changes no Solidity at all', () => {
    // Measured, and it is why the grid rows exist: the parse really does go
    // blind here, and the two answers it then gives are the two a lawful
    // contract without the rule would give.
    const renamed = parseSixes(CONTRACT.replace('roll == MAX_ROLL', 'roll == 6'));
    expect(renamed.fallbackWrittenOnEverySix).toBe(false);
    expect(renamed.resetsAt).toBeNull();
    expect(parseSixes(CONTRACT).fallbackWrittenOnEverySix).toBe(true);

    // The finding is gone from the answers and the blindness is in its place,
    // which is the difference between a deleted finding and a reported one.
    const reasons = compareSixes(renamed).map((one) => one.reason);
    expect(reasons.some((one) => one.includes('cannot move them'))).toBe(false);
    expect(reasons.some((one) => one.includes('could not be read'))).toBe(true);
  });

  it('says nothing extra about the contract this repository vendors', () => {
    // The point of every row above: this one means something. All three
    // readings happen on the real source, so the readability state adds no
    // divergence to it and the two recorded findings stand alone.
    const sixes = parseSixes(CONTRACT);
    expect(compareSixes(sixes)).toEqual(compareSixes(withoutTheReading(sixes)));
  });
});

describe('what the summary claims agreement about', () => {
  /**
   * `describeDivergences` had *the board* written into it, and the sixes
   * comparison prints through the same function. An empty sixes result
   * therefore announced agreement about twenty jumps the comparison had not
   * looked at — the right answer to a question nobody asked.
   */
  it('names what was compared, rather than always the board', () => {
    expect(describeDivergences([], 'the run of sixes')).toBe(
      'the contract and the engine agree on the run of sixes',
    );
    expect(describeDivergences([], 'the run of sixes')).not.toContain('board');
    expect(describeDivergences([], 'the board')).toBe(
      'the contract and the engine agree on the board',
    );
  });
});
