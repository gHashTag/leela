import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import {
  CLASSIC,
  advance,
  hasWon,
  isWaitingToEnter,
  owesReport,
  submitReport,
  type Session,
} from '@leela/engine';
import { newGame, owesAnAccount, squareToRead, standingOn, type Game } from '../src/game';

/**
 * The two states that are both `is_finished`, and what this surface owes each.
 *
 * A player who has never thrown a six stands on **68**. So does a player who
 * has reached Cosmic Consciousness and won. The engine records both as
 * `is_finished`, and every surface that reads `loka` without asking which one
 * it is has told a beginner they are standing where the game ends.
 *
 * It has now been found seven times: the bot's standings, `render.ts` twice,
 * the mini app's `view.ts`, `/plan` before a first roll, `/ask` answering from
 * the winning square's text — and here, where opening the app printed *68.
 * Cosmic Consciousness (Vaikuntha Loka)* and the whole teaching of that square
 * to somebody who had not begun, under a line correctly telling them to throw a
 * six.
 *
 * `packages/engine/tests/sixty-eight.test.ts` is this table for the engine and
 * the mini app and the bot each have their own. This is the phone's, and it is
 * the reason there will not be an eighth on this surface.
 *
 * **The table asserts values, not that the two answers differ.** The first
 * version of the engine's went green with both of them wrong — see the
 * hundredth pass.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** A game whose seat has been put into a given state, without a rule of ours. */
function played(rolls: readonly number[]): Game {
  let game = newGame(1);
  let session: Session = game.session;
  for (const roll of rolls) {
    // Through the engine, so the states here are states the game can reach
    // rather than ones a test has arranged.
    session = advance(session, roll, Date.now()).session;
  }
  return { ...game, session };
}

const waiting = played([]);
const entered = played([6]);

describe('a player who has never thrown a six', () => {
  it('has their piece on 68, because that is where the game parks them', () => {
    // The mark is right and stays: the published app draws the gem there from
    // the first screen — `initStore` is `plans: [68, 68, …]`.
    expect(standingOn(waiting)).toBe(68);
    expect(isWaitingToEnter(waiting.session.players[0]!.state)).toBe(true);
    expect(hasWon(waiting.session.players[0]!.state)).toBe(false);
  });

  it('has no square to read', () => {
    // The whole finding, as one value. `null` and not 68.
    expect(squareToRead(waiting)).toBe(null);
  });

  it('owes no account, having arrived nowhere', () => {
    expect(owesAnAccount(waiting)).toBe(false);
  });
});

describe('a player who has won', () => {
  /**
   * The other half, and the reason `squareToRead` cannot simply refuse 68: a
   * winner is legitimately standing there and that text is what the whole game
   * was played to reach. A check that hid 68 would take it from them.
   */
  const won = (() => {
    // The engine's own idiom, from `packages/engine/tests/sixty-eight.test.ts`:
    // play games with a seeded die until one of them reaches the end. A state
    // assembled by hand would assert against a shape this game may never
    // produce, and a walk that picks its own rolls fights the board — snakes
    // and arrows decide where a throw lands, not the thrower.
    //
    // The account is filed with `submitReport` because the gate stands between
    // one throw and the next; setting `reportSubmitted` would step over it.
    for (let seed = 1; seed <= 200; seed += 1) {
      const start = newGame(seed);
      let session = start.session;
      const die = start.die;

      for (let turn = 0; turn < 400; turn += 1) {
        const seat = session.players[0]!;
        if (hasWon(seat.state)) return { ...start, session };
        if (owesReport(seat.state, CLASSIC) && !seat.reportSubmitted) {
          session = submitReport(session, 'p1', Date.now());
        }
        session = advance(session, die(), Date.now()).session;
      }
    }

    throw new Error('no seed reached Cosmic Consciousness');
  })();

  it('really did reach the end, or this describe proves nothing', () => {
    expect(hasWon(won.session.players[0]!.state), 'the walk did not finish').toBe(true);
  });

  it('stands on 68 and may read it', () => {
    expect(standingOn(won)).toBe(68);
    expect(squareToRead(won)).toBe(68);
  });
});

describe('a player in play', () => {
  it('reads the square they are on', () => {
    expect(standingOn(entered)).toBe(6);
    expect(squareToRead(entered)).toBe(6);
  });
});

describe('the rule, over the source', () => {
  /**
   * The guard against the eighth sighting: a screen that reaches for the raw
   * square where a text is drawn.
   *
   * `standingOn` is the board's question and `squareToRead` is the reader's.
   * `App.tsx` may use `here` to mark a cell and must use `square` for anything
   * that shows a plan's words — so the two names are held apart here, over the
   * file, because a comment cannot stop the next person writing `here` into a
   * `<Text>`.
   */
  const app = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));

  it('asks the reader’s question before showing a plan', () => {
    expect(app).toContain('squareToRead(game)');
  });

  it('never draws a plan’s words from the raw square', () => {
    // `planFor(language, here)` is the defect exactly. Any of its spellings.
    for (const wrong of ['planFor(language, here)', 'writingsOn(journal, here)']) {
      expect(app, wrong).not.toContain(wrong);
    }
  });
});
