/**
 * The end of a game, played through the app's own functions.
 *
 * `sixty-eight.test.ts` walks a game to Cosmic Consciousness with `advance` and
 * `submitReport` — the engine's own calls — and asks what the app's *readers*
 * then say. `no-rules.test.ts` plays through `throwDie`, and stops at
 * `isOver(game)` without asking what being over means. So the phone's own play
 * path had never been taken to the end, which is the same gap the chat and the
 * mini app each had until it was played.
 *
 * Taken here: throw with `throwDie`, write with `takeAccount` — the path with a
 * store behind it, not `fileReport`, which is the gate half alone — and then
 * read the end.
 *
 * The die is shut on the winning square, and shut to the act as well: throwing
 * again returns the same game rather than raising out of a handler, which is the
 * defect `canCurrentPlayerRoll`'s session guard was written for. The winner
 * still owes an account — the report gate carried to the last square, as in the
 * chat and in the browser. And that account is taken, kept, and filed under 68.
 *
 * A seed is searched for rather than pinned. One that wins today is one throw
 * away from not winning tomorrow, and `sixty-eight.test.ts` asks the same way.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { hasWon } from '@leela/engine';
import {
  fileReport,
  isOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  throwDie,
  type Game,
} from '../src/game';
import { takeAccount } from '../src/journal';

const ASKING = 'to see it through to the end';

/** A store that keeps what it is given, so `takeAccount` has somewhere to write. */
function held() {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

/**
 * A game played to Cosmic Consciousness through the app's own calls.
 *
 * Every square is thrown for and every owed account written, because a game
 * that skipped the gate would not be the one a player plays.
 */
function playedToTheEnd(): Game {
  for (let seed = 1; seed < 500; seed += 1) {
    let game = newGame(seed);

    for (let turn = 0; turn < 3000; turn += 1) {
      if (hasWon(game.session.players[0]!.state)) return game;

      if (owesAnAccount(game)) {
        game = fileReport(game);
        continue;
      }

      const thrown = throwDie(game, ASKING);
      // A throw that changes nothing means the die is shut for a reason this
      // loop does not know about; try another seed rather than spin forever.
      if (thrown.game === game) break;
      game = thrown.game;
    }
  }

  throw new Error('no seed under five hundred reached Cosmic Consciousness');
}

describe('a game played to its end on the phone', () => {
  let won: Game;

  beforeAll(() => {
    won = playedToTheEnd();
  });

  it('stands on the winning square', () => {
    expect(standingOn(won)).toBe(68);
    expect(hasWon(won.session.players[0]!.state)).toBe(true);
    expect(isOver(won)).toBe(true);
  });

  it('shuts the die, and shuts it to the act as well', () => {
    // Both halves, because the drawing and the act are separate answers: a
    // button that is dimmed and a call that still moves the player is the
    // defect one level in. Throwing on a finished session used to raise inside
    // the handler, which is why the guard exists at all.
    expect(mayThrow(won, ASKING)).toBe('finished');

    const again = throwDie(won, ASKING);
    expect(again.game, 'the same game, not a moved one').toBe(won);
    expect(standingOn(again.game)).toBe(68);
  });

  it('leaves the last account still to be written', () => {
    // The report gate carried to the last square. The chat says so in words and
    // the browser by keeping the writing box open; here it is the answer to a
    // question, and it must be the same answer.
    expect(owesAnAccount(won)).toBe(true);
  });

  it('takes that account, keeps it, and files it under the winning square', () => {
    // `takeAccount` rather than `fileReport`: the gate opening and the words
    // being kept are two answers, and running them together is how a refused
    // write came to be reported as written in the app next door.
    const taken = takeAccount(
      { entries: [] },
      standingOn(won),
      'I got here, and it turned out not to be about the square',
      1_700_000_000_000,
      held(),
      won.rules,
    );

    expect(taken.written, 'the words counted as an account').toBe(true);
    expect(taken.kept, 'and the store held them').toBe(true);
    expect(taken.journal.entries.map((entry) => entry.plan)).toEqual([68]);
  });

  it('refuses an account that is not one, even on the last square', () => {
    // The gate does not loosen because the game is ending. `minReportChars` is
    // the variant's, and the winning square is not an exception to it.
    const empty = takeAccount({ entries: [] }, standingOn(won), '   ', 1_700_000_000_000, held(), won.rules);

    expect(empty.written).toBe(false);
    expect(empty.journal.entries).toEqual([]);
  });
});
