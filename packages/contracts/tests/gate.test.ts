import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript. Solidity takes
// the same two comment forms JavaScript does.
import { blank } from '../../../scripts/lib/source.mjs';
import { ONCHAIN } from '@leela/engine';

/**
 * What the report gate on chain actually asks.
 *
 * `contracts/README.md` says this contract is *the only implementation that
 * ever enforced* the rule that a player writes before they throw, and
 * `ONCHAIN.requireReportBeforeRoll` says so too. Both are read off one line:
 *
 * ```solidity
 * require(
 *   reports[reportIdCounter].reporter == msg.sender,
 *   'You must create a report before rolling the dice.'
 * );
 * ```
 *
 * The sentence in it is what everybody has quoted. The condition is a different
 * rule: `reportIdCounter` is the id of the last report filed by **anybody**, so
 * what is being asked is *were you the last person to write* — not *have you
 * written about the square you are standing on*.
 *
 * Two consequences, both of them the contract's, not a proposal about it.
 * Alone, a player writes once and may throw for the rest of the game: nothing
 * on the roll path touches `reports` or `reportIdCounter`, so the answer cannot
 * change. At a table, the gate becomes a turn-taking rule nobody wrote — B's
 * report shuts A out until A writes again.
 *
 * And the flag that would have been the rule as everyone reads it —
 * `playerReportCreated`, set true on a report and false on a roll — is written
 * in both places and **read nowhere**. It is the intended gate, kept as public
 * state, never consulted.
 *
 * None of this is a bug to fix: the bytecode is deployed and unreachable, and
 * `onchain` describes it rather than correcting it. It is a description to get
 * right, which is what this package is for.
 */

const CONTRACT = blank(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'LeelaGame.sol'),
    'utf8',
  ),
);

/** The body of a named function, by brace depth. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`no function ${name}`);

  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, at);
    }
  }

  throw new Error(`function ${name} is never closed`);
}

const ROLL_PATH = ['rollDice', 'handleRollResult', 'movePlayer'].map((name) =>
  functionBody(CONTRACT, name),
);

describe('the gate the contract actually has', () => {
  it('asks who wrote last, not whether this player has written', () => {
    // The condition, not the sentence beside it. A check that matched the
    // message would pass a contract that gates on nothing at all.
    const roll = functionBody(CONTRACT, 'rollDice');
    expect(roll).toMatch(/require\(\s*reports\[reportIdCounter\]\.reporter\s*==\s*msg\.sender/);
  });

  it('is asked only of a player in play, so a winner is not held by it', () => {
    const roll = functionBody(CONTRACT, 'rollDice');
    expect(roll).toMatch(/if\s*\(\s*player\.isStart\s*\)\s*\{\s*require\(/);
  });

  it('keeps a flag that reads like the rule and consults it nowhere', () => {
    /**
     * The shape, not the two lines: every mention of `playerReportCreated`
     * outside its declaration is an assignment to it. A future edit that reads
     * it — in a `require`, an `if`, a return — makes this fail, which is the
     * point: the flag becoming live would be a change to what the gate means.
     */
    const declaration = /mapping\(address => bool\) public playerReportCreated;/;
    expect(CONTRACT).toMatch(declaration);

    // The declaration is where the name is introduced, not where it is used.
    const uses = CONTRACT.replace(declaration, '');
    const mentions = [...uses.matchAll(/playerReportCreated(\s*\[[^\]]*\])?\s*(=[^=]|.)/g)];

    expect(mentions.length, 'it is there to be found').toBeGreaterThan(1);

    for (const mention of mentions) {
      const after = mention[2] ?? '';
      // `= x` is an assignment; `==`, `)`, `,` or `;` would be a reading.
      expect(after.startsWith('='), `read at index ${mention.index}`).toBe(true);
    }
  });

  it('changes nothing the gate reads when a player throws', () => {
    /**
     * Why one report lets a lone player throw for the rest of the game. The
     * gate reads `reports[reportIdCounter]`; both are written in `createReport`
     * and in no function on the roll path. Asserted over the whole path rather
     * than over `rollDice`, because a write in either of the two it calls would
     * do it just as well.
     */
    for (const body of ROLL_PATH) {
      expect(body, 'the counter').not.toMatch(/reportIdCounter\s*(\+\+|--|=[^=])/);
      expect(body, 'the report itself').not.toMatch(/reports\[[^\]]*\]\s*=[^=]/);
    }
  });

  it('moves the counter only where a report is made', () => {
    // The other half: if nothing ever moved it, the gate would be about the
    // one report that exists and this reading would be describing nothing.
    expect(functionBody(CONTRACT, 'createReport')).toMatch(/reportIdCounter\+\+/);
  });
});

describe('the rest of what the onchain ruleset claims', () => {
  /**
   * Four of the twelve fields were held to the Solidity; the rest were memory.
   * That is precisely how the one wrong flag got in — `onchain` carried
   * `classic`'s values for the five rules added after it was written, and the
   * winning square was one of them.
   *
   * So each remaining field is read off the source here, or recorded as one the
   * contract cannot express and why.
   */

  it('resets a run of three sixes, and to a square it names', () => {
    const handle = functionBody(CONTRACT, 'handleRollResult');

    expect(ONCHAIN.threeSixesReset).toBe(true);
    expect(handle).toMatch(/consecutiveSixes\s*==\s*3/);
    expect(handle).toMatch(/plan\s*=\s*player\.positionBeforeThreeSixes/);
  });

  it('gives a six no second throw, because a six is a throw like any other', () => {
    // `extraTurnOnSix: false`. After the count is bumped, the six falls
    // through to `movePlayer` exactly as a two would, and the next call to
    // `rollDice` meets the same gate. Nothing anywhere grants another roll.
    const handle = functionBody(CONTRACT, 'handleRollResult');

    expect(ONCHAIN.extraTurnOnSix).toBe(false);
    expect(handle).toMatch(/movePlayer\(roll, playerAddress\)/);
    expect(CONTRACT, 'no notion of a turn at all').not.toMatch(/extraTurn|anotherRoll|freeRoll/i);
  });

  it('still asks for a report after a six, since the gate is asked before every throw', () => {
    // `reportAfterSix: true`. The gate is outside any test of the last roll —
    // it is asked of `player.isStart` and of nothing else.
    const roll = functionBody(CONTRACT, 'rollDice');
    const gate = roll.slice(roll.indexOf('if (player.isStart)'), roll.indexOf('rollResult == 6'));

    expect(ONCHAIN.reportAfterSix).toBe(true);
    expect(gate, 'the gate does not look at the throw').not.toMatch(/rollResult|MAX_ROLL/);
  });

  it('never re-rolls a repeated square', () => {
    // `rerollOnRepeat: false`, asserted as the absence it is: no branch
    // compares the new square to the old one and throws again.
    expect(ONCHAIN.rerollOnRepeat).toBe(false);
    expect(functionBody(CONTRACT, 'movePlayer')).not.toMatch(/newPlan\s*==\s*player\.plan\b/);
  });

  it('keeps no clock, which is why the cooldown fields describe nothing', () => {
    /**
     * `turnCooldownMs: 0`, and with it `cooldownFrom` and
     * `refusedThrowStartsCooldown` have nothing to be about. A contract has no
     * timer: `block.timestamp` is stamped onto a report and read by nothing
     * that decides whether a throw is allowed.
     *
     * Recorded rather than silently inherited. A field that cannot apply and a
     * field that happens to match are the same value with different meanings,
     * and the first is the one that gets copied wrong.
     */
    expect(ONCHAIN.turnCooldownMs).toBe(0);

    for (const body of ROLL_PATH) {
      expect(body, 'no clock is consulted on the way to a throw').not.toMatch(/block\.timestamp/);
    }
    expect(functionBody(CONTRACT, 'createReport'), 'only stamped').toMatch(
      /timestamp:\s*block\.timestamp/,
    );
  });
});
