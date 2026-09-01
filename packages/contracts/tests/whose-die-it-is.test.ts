/**
 * Who throws the die on chain.
 *
 * This package exists to know *precisely where the contract agrees with the
 * engine and where it does not*. It checks the board — twenty jumps, the win
 * square, the size — the report gate and the run of sixes. It had never asked
 * the question a player would ask first.
 *
 * **The die is the caller's.** `rollDice(uint8 rollResult)` takes the number as
 * an argument and checks only that it is between one and six. Everything after
 * that — the gate, the jumps, the three-sixes reset — is enforced exactly as
 * written, on a number the player chose. On every other surface the die is
 * `rollerFor(CLASSIC, rollDie)`, which is the variant's own and not the
 * player's.
 *
 * That may well be deliberate: a contract that only records what a client
 * rolled is a ledger rather than a referee, and this one charges no token and
 * generates nothing. It is written down here because a divergence nobody has
 * written down is one somebody will later mistake for an oversight — or, worse,
 * assume is not there.
 *
 * **And the family holds two contracts.** Measured against the donor:
 * `smart-contract-leela/contracts/LeelaGame.sol` is the file this package
 * checks, byte for byte. `leela-ai-web3/contracts/LeelaGame.sol` has **the same
 * board** — twenty jumps and three constants, no divergence at all — and a
 * different die: `rollDice()` with no argument, returning
 * `keccak256(block.timestamp, blockhash(block.number - 1), msg.sender) % 6 + 1`.
 * One takes the roll from the player and one takes it from the chain. The donor
 * is not in CI, so that comparison is recorded rather than asserted; what is
 * asserted here is the shape of the file this repository ships.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONCHAIN, rollDie } from '@leela/engine';

const CONTRACT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'LeelaGame.sol'),
  'utf8',
);

/** The parameters a function is declared with, as written. */
function parametersOf(source: string, name: string): string {
  return new RegExp(`function\\s+${name}\\s*\\(([^)]*)\\)`).exec(source)?.[1]?.trim() ?? '';
}

describe('the die in the contract', () => {
  it('is handed in by whoever calls it', () => {
    // The shape rather than the signature: whatever it is named, the number
    // arrives from outside. A contract that started throwing its own would
    // change what this package has to say about it, and should say so here
    // first.
    expect(parametersOf(CONTRACT, 'rollDice')).toMatch(/uint8?\s*\w*roll/i);
  });

  it('is not generated anywhere in the file', () => {
    // The other half. A source that took an argument *and* had a generator in
    // it would be a different thing again — the other contract in this family
    // does generate, from block data, and this is not that one.
    //
    // `block.timestamp` is not on this list and the first version of it was:
    // this contract stamps reports and comments with the block's time, six
    // times over, and none of that touches the roll. A check that called those
    // randomness would have been wrong about the file in order to be right
    // about the die.
    for (const source of ['keccak256', 'blockhash', 'prevrandao', 'block.difficulty']) {
      expect({ source, present: CONTRACT.includes(source) }).toEqual({ source, present: false });
    }
  });

  it('is bounded, and that is the whole of what it is checked against', () => {
    // One and six. Every rule after this point is enforced on a number the
    // player picked, which is what makes the bound the only thing between a
    // player and a six every turn.
    expect(CONTRACT).toMatch(/rollResult\s*>=\s*1\s*&&\s*rollResult\s*<=\s*MAX_ROLL/);
    expect(CONTRACT).toMatch(/constant\s+MAX_ROLL\s*=\s*6/);
  });

  it(`bounds it to the faces the engine own die has`, () => {
    // The one thing the two agree on about the die. A `RuleSet` has no field
    // for how many faces there are — six is what `rollDie` is — so the
    // comparison is made against the die itself rather than against a number
    // written down twice.
    const faces = Number(/constant\s+MAX_ROLL\s*=\s*(\d+)/.exec(CONTRACT)?.[1]);
    const thrown = new Set(Array.from({ length: 600 }, () => rollDie()));

    expect(Math.max(...thrown)).toBe(faces);
    expect(Math.min(...thrown)).toBe(1);
  });

  it('is a turn the engine can describe in every way but that one', () => {
    // `ONCHAIN` is this contract as a `RuleSet`: the gate, the run of sixes,
    // no cooldown. It has no field for who throws, and adding one would be a
    // field nothing reads — so the divergence lives here, in the package whose
    // subject is exactly that.
    expect(ONCHAIN.requireReportBeforeRoll).toBe(true);
    expect(ONCHAIN.threeSixesReset).toBe(true);

    // Every field, named. The first version asked whether any of them matched
    // `/die|roll|random/` and it does — `rerollOnRepeat`,
    // `requireReportBeforeRoll`, `refusedThrowStartsCooldown` all say *roll*.
    // They say when a throw is allowed and what follows it, and none says where
    // the number came from. Listed rather than pattern-matched so that adding
    // one is a thing somebody has to come here and read about.
    expect(Object.keys(ONCHAIN).sort()).toEqual([
      'cooldownFrom',
      'extraTurnOnSix',
      'id',
      'mayReenterAfterWinning',
      'minReportChars',
      'refusedThrowStartsCooldown',
      'reportAfterSix',
      'reportOnWinningSquare',
      'requireReportBeforeRoll',
      'rerollOnRepeat',
      'threeSixesReset',
      'turnCooldownMs',
    ]);
  });

  it('leaves the gate and the jumps to the contract, which they are', () => {
    // Stated so the record is not read as *nothing here is enforced*. The
    // report gate and the board are the contract's own and are checked
    // elsewhere in this package; it is the number they act on that is not.
    expect(CONTRACT).toContain('You must create a report before rolling the dice.');
    expect(CONTRACT).toMatch(/newPlan\s*==\s*\d+\s*\)\s*\{\s*newPlan\s*=\s*\d+\s*;/);
  });
});
