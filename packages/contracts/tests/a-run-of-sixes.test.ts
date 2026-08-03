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
import { compareSixes, parseSixes } from '../src/verify';

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
