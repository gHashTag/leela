/**
 * May this player throw? Asked twice, in two spellings.
 *
 * Both surfaces that draw a board have a `mayThrow`, and both files carry a
 * comment about the same defect: *the rest was written out by hand and
 * re-decided `report-required` and `finished` under the names `owes-report` and
 * `game-over`, while the bot asked `canCurrentPlayerRoll`. Three surfaces, one
 * question, and only one of them asking it — which is how the phone came to
 * have no intention gate at all.*
 *
 * That was repaired: both ask the engine now. What was left is the part each
 * surface still answers for itself — the question the game is played to answer,
 * which the engine has never heard of. And there the two had drifted apart
 * again, quietly: the phone asked `intention.trim() === ''` and the mini app
 * asked `intention === ''`, so three spaces were no question on a phone and a
 * question in a browser.
 *
 * Unreachable today — every assignment to that variable trims, in both apps, in
 * four places — which is exactly the state a hand-kept agreement is in the
 * moment before it stops holding. Nothing asserted it, so nothing would have
 * said which of the four had stopped.
 *
 * This asserts the shape rather than the spelling: **for a state either surface
 * can be in, the two answer the same.** The differences each keeps on purpose
 * are held constant — a spin is an animation the engine has never heard of, and
 * the mini app asks the journal as well as the seat, because it keeps two
 * records where the phone keeps one.
 */

import { describe, expect, it } from 'vitest';
import { CLASSIC, ONLINE, advance, createSession, type RuleSet, type Session } from '../src/index';
// The two boards, imported the way only a test of the crossing can: neither app
// depends on the other, and what they share is the engine, which is this
// package.
import { mayThrow as onThePhone } from '../../../apps/mobile/src/game';
import { mayThrow as inTheBrowser } from '../../../apps/miniapp/src/view';

const NOW = 2_000_000_000_000;

/** A game one player is in, played by the rolls given. */
function played(rules: RuleSet, rolls: number[]): Session {
  let session = createSession('device', [{ id: 'p1', name: 'You' }], rules);

  for (const roll of rolls) {
    try {
      session = advance(session, roll, NOW).session;
    } catch {
      // A refused throw is a state worth asking about too.
    }
  }

  return session;
}

/** The phone's board holds a session inside a game; this is the rest of it. */
const asAGame = (session: Session, rules: RuleSet) => ({
  session,
  rules,
  die: () => 1,
  rollsTaken: 0,
  event: null,
  seed: 1,
});

/** Every state either surface can put in front of a player. */
const states: Array<{ what: string; session: Session; rules: RuleSet }> = [
  { what: 'waiting to enter', session: played(CLASSIC, []), rules: CLASSIC },
  { what: 'refused, not a six', session: played(CLASSIC, [3]), rules: CLASSIC },
  { what: 'just entered, owing an account', session: played(CLASSIC, [6]), rules: CLASSIC },
  { what: 'entered under online rules', session: played(ONLINE, [6]), rules: ONLINE },
  { what: 'a run of two sixes', session: played(CLASSIC, [6, 6]), rules: CLASSIC },
];

const questions = ['', ' ', '   ', '\n\t ', 'to see what I keep avoiding'];

describe('may this player throw', () => {
  it('is answered the same on both boards', () => {
    // The shape. Not "three spaces are refused" — that is one spelling of one
    // case — but that neither surface has an answer the other does not.
    const differing: string[] = [];

    for (const { what, session, rules } of states) {
      for (const intention of questions) {
        const phone = onThePhone(asAGame(session, rules), intention, NOW);
        // Held constant: a spin belongs to the browser's die animation, and the
        // journal-owed flag to a record the phone does not keep separately.
        const browser = inTheBrowser(session, intention, false, false, NOW);

        if (phone !== browser) {
          differing.push(`${what}, question ${JSON.stringify(intention)}: ${phone} / ${browser}`);
        }
      }
    }

    expect(differing).toEqual([]);
  });

  it('refuses a question that is only spaces, on both', () => {
    // Named as well as compared, because "they agree" is also satisfied by both
    // letting a blank question through.
    for (const intention of ['', ' ', '   ', '\n\t ']) {
      const session = played(CLASSIC, []);

      expect({ intention, phone: onThePhone(asAGame(session, CLASSIC), intention, NOW) }).toEqual({
        intention,
        phone: 'no-intention',
      });
      expect({ intention, browser: inTheBrowser(session, intention, false, false, NOW) }).toEqual({
        intention,
        browser: 'no-intention',
      });
    }
  });

  it('lets a real question through, so the agreement is not that nobody throws', () => {
    const session = played(CLASSIC, []);
    const asked = 'to see what I keep avoiding';

    expect(onThePhone(asAGame(session, CLASSIC), asked, NOW)).toBe('yes');
    expect(inTheBrowser(session, asked, false, false, NOW)).toBe('yes');
  });

  it('answers with the engine, not with a second opinion', () => {
    // The repair the comments record: both hand the rest to
    // `canCurrentPlayerRoll`. A player owing an account is refused for the
    // engine's reason and under the engine's name.
    const owing = played(CLASSIC, [6]);
    const asked = 'to see what I keep avoiding';

    expect(onThePhone(asAGame(owing, CLASSIC), asked, NOW)).toBe('report-required');
    expect(inTheBrowser(owing, asked, false, false, NOW)).toBe('report-required');
  });

  it('keeps the differences each surface owns', () => {
    // The browser refuses while its die is spinning, and refuses on a journal
    // that owes an account even when the seat does not. Neither is a rule of
    // the game, and neither is the phone's to have.
    const session = played(CLASSIC, []);
    const asked = 'to see what I keep avoiding';

    expect(inTheBrowser(session, asked, true, false, NOW)).toBe('rolling');
    expect(inTheBrowser(session, asked, false, true, NOW)).toBe('report-required');
  });
});
