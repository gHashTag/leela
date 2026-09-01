// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mayLeaveTheQuestion } from '../src/view';

/**
 * Whether the question can be walked away from.
 *
 * A decision no test defended. `audit-mutants` was pointed at it for the first
 * time this pass and replaced it with `true`, and then with `false`, and the
 * whole suite stayed green both times — the only one of sixty-eight that
 * nothing noticed.
 *
 * What was checked was the *line*: `named.test.ts` asserts that `main.ts`
 * contains `el.intentionClose.hidden = !mayLeaveTheQuestion(intention)`, which
 * is true however the function answers. A check on a mention passes an empty
 * function, which is the failure this repository has met before one import at a
 * time.
 *
 * The rule it holds is the one the published app states by blocking the back
 * gesture: a player who has not answered cannot leave the question, because the
 * die is shut until they do and *Change it* — the only way back in — is not
 * drawn until there is something to change. And it is right the first time and
 * wrong every time after: a returning player must be able to close it and keep
 * the question they already have.
 */

describe('the way out of the question', () => {
  it('is closed while there is no question to come back to', () => {
    expect(mayLeaveTheQuestion('')).toBe(false);
  });

  it('is open once one is held', () => {
    expect(mayLeaveTheQuestion('to see what I keep avoiding')).toBe(true);
  });

  it('reads whitespace as no question, as everything else here does', () => {
    // `isIntention` refuses it, `saveIntention` refuses it, and a dialog that
    // let a player out on a box of spaces would leave them with a dark die.
    for (const nothing of [' ', '\n', '\t  \n']) {
      expect(mayLeaveTheQuestion(nothing), JSON.stringify(nothing)).toBe(false);
    }
  });

  it('is one question, not two spellings of it', () => {
    /**
     * The Close button is drawn from this and the dialog's `cancel` handler
     * used to ask `intention === ''` in its own words — one rule with two
     * spellings, which is how a control and the act behind it come to
     * disagree. They cannot now: a blank-but-not-empty question would have
     * hidden the button and let the gesture through.
     */
    expect(mayLeaveTheQuestion('   ')).toBe(false);
  });
});
