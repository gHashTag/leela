import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { CLASSIC, ONLINE } from '@leela/engine';
import {
  fileReport,
  isOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  startOver,
  throwDie,
  type Game,
} from '../src/game';
import { NOTHING_WRITTEN, draftFor, draftOn, takeAccount } from '../src/journal';

/**
 * Beginning again, and what the game just ended leaves behind.
 *
 * The screen said `onPress={() => setGame(newGame(startingSeed()))}` — a whole
 * act in one expression, asking nothing, keeping nothing straight and saying
 * nothing. Three faults in eleven characters of handler:
 *
 *   - it trusted the drawing, which is the shape three defects in the mini app
 *     came from and the reason `throwDie` re-asks `mayThrow` five lines from a
 *     control that is already disabled;
 *   - it took the **default** ruleset, so a game begun under any other variant
 *     came back as `CLASSIC`;
 *   - and it left the unfiled account of the winning square in the box.
 *
 * The third is the one that reaches the player's record, and it is reachable in
 * ordinary play: `owesAnAccount` and `isOver` are **both true** on 68.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));

/** A game played to its end, reporting whenever the gate asks. */
function won(seed = 1): Game {
  let game = newGame(seed);
  for (let turn = 0; turn < 5_000 && !isOver(game); turn += 1) {
    game = owesAnAccount(game) ? fileReport(game) : throwDie(game, 'why I am playing').game;
  }

  expect(isOver(game), 'a game that reaches its end in 5,000 turns').toBe(true);
  return game;
}

describe('the moment the two controls share', () => {
  it('offers a restart and asks for an account, at the same time, on the same square', () => {
    /**
     * The whole reason the draft matters. `CLASSIC` asks for a report on 68 —
     * the square a whole game is played to reach was, for a while, the one
     * arrival nobody was ever asked to write about — and winning also ends the
     * game. So the writing box and *Start over* are on screen together, and
     * whichever is tapped first decides what happens to the words.
     */
    const game = won();

    expect(standingOn(game), 'the winning square').toBe(68);
    expect(isOver(game), 'Start over is offered').toBe(true);
    expect(owesAnAccount(game), 'and an account is still owed').toBe(true);
  });
});

describe('an act asks its own question', () => {
  it('refuses a game still being played, and changes nothing at all', () => {
    // Not merely "returns a game that looks the same": the same object, so a
    // refused act cannot even cause a redraw.
    const playing = newGame(7);
    const refused = startOver(playing, 99);

    expect(refused.begun).toBe(false);
    expect(refused.game).toBe(playing);
  });

  it('begins one when the game is over', () => {
    const over = startOver(won(), 99);

    expect(over.begun).toBe(true);
    expect(over.game.rollsTaken).toBe(0);
    expect(over.game.event).toBe(null);
    expect(standingOn(over.game), 'waiting to enter, which the engine parks on 68').toBe(68);
    expect(owesAnAccount(over.game), 'a new game owes nothing yet').toBe(false);
  });

  it('is asked by the screen and not only drawn from', () => {
    // The handler used to construct the game itself. A screen that builds a
    // game is a screen that decides one.
    expect(APP).toContain('startOver(game, startingSeed())');
    expect(APP, 'no game is made in a handler').not.toMatch(/onPress=\{\(\) => setGame\(newGame/);
  });
});

describe('the rules carry forward', () => {
  it('keeps the variant the game was being played under', () => {
    /**
     * `newGame(seed)` takes the default. A restart that quietly changes which
     * game is being played is the one thing this repository does not allow
     * between surfaces, let alone between two halves of one screen — and the
     * ruleset decides the report gate, the entering six and the three sixes.
     */
    const over = startOver({ ...won(), rules: ONLINE }, 99);

    expect(over.game.rules).toBe(ONLINE);
    expect(over.game.session.rules, 'and the session, which is what decides').toBe(ONLINE);
  });

  it('keeps one answer, not two', () => {
    // `Game.rules` and `Game.session.rules` are the same fact. Two records of
    // one fact is this repository's most-repeated defect; here they must agree
    // however the game was made.
    for (const rules of [CLASSIC, ONLINE]) {
      const fresh = newGame(3, rules);
      expect(fresh.rules).toBe(fresh.session.rules);
      expect(startOver({ ...won(), rules }, 99).game.rules).toBe(rules);
    }
  });
});

describe('what is being written belongs to one square of one game', () => {
  /**
   * The shape, rather than the restart. A draft that is a bare string is a
   * draft attached to nothing, and it outlives whatever it was written about —
   * restart is simply the one act in this app that moves a player without
   * filing what they had begun.
   */
  it('is shown on the square it was written about', () => {
    const draft = draftOn(42, 30, 'what this square asked of me');

    expect(draftFor(draft, 42, 30)).toBe('what this square asked of me');
  });

  it('is not shown on any other square', () => {
    const draft = draftOn(42, 30, 'about thirty');

    expect(draftFor(draft, 42, 31), 'the next square').toBe('');
    expect(draftFor(draft, 42, null), 'a player who has not entered').toBe('');
  });

  it('is not shown in another game, on the same square', () => {
    /**
     * The case a plan alone cannot catch, and the reason the seed is in it: a
     * player wins, writes about 68, starts over, plays a whole second game and
     * wins that one too. Both games end standing on 68.
     */
    const draft = draftOn(42, 68, 'the end of the last game');

    expect(draftFor(draft, 43, 68)).toBe('');
  });

  it('opens empty', () => {
    expect(draftFor(NOTHING_WRITTEN, 42, 30)).toBe('');
  });

  it('cannot survive the restart, because the seed cannot repeat', () => {
    // Not "the handler remembers to clear it". `startOver` refuses to hand back
    // the seed it was given, so the game that replaces one is never the same
    // game to a draft, to the die, or to the saved board.
    const finished = won();
    const over = startOver(finished, finished.seed);

    expect(over.game.seed).not.toBe(finished.seed);
    expect(draftFor(draftOn(finished.seed, 68, 'unfiled'), over.game.seed, 68)).toBe('');
  });

  it('would have filed the wrong square before', () => {
    /**
     * The guard against the check passing for want of a case. This is what the
     * screen did: one string, no square, handed to `takeAccount` with whatever
     * the player is standing on **now**.
     */
    const carried = 'what Cosmic Consciousness asked of me';
    const store = new Map<string, string>();
    const taken = takeAccount({ entries: [] }, 6, carried, 1_000, {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    });

    expect(taken.written).toBe(true);
    expect(taken.journal.entries[0]?.plan, 'filed against where they stand now').toBe(6);
    expect(taken.journal.entries[0]?.text).toBe(carried);
  });
});

describe('the line under the board', () => {
  it('is replaced when the game is', () => {
    /**
     * `said` survived the act, so a restart taken straight after filing the
     * winner's account left *Written. You may throw.* over a board that had
     * just been emptied — the mini app's 97th-pass defect, in a new place.
     */
    expect(APP).toContain("setSaid(messageFor(language, 'app.restarted'))");
  });
});

describe('beginning again is beginning with the question too', () => {
  /**
   * The board was emptied and the seed replaced so that nothing being written
   * about the winning square could survive into the game that replaced it. The
   * sentence the finished game was *played to answer* survived all of it: it
   * stood over the new game, and the gate before the first throw — the one this
   * app was given because it let a player straight to the die — was already
   * open on it. Nobody beginning again was asked what they were beginning for.
   *
   * The bot reached the same place from the other end and answered it the same
   * way: `/end` lets go of the question along with the game.
   */
  const finished = (): Game => {
    let game = newGame(1_700_000_000_000);
    const intention = 'to see what I keep avoiding';

    for (let turn = 0; turn < 500 && !isOver(game); turn += 1) {
      if (mayThrow(game, intention, 1_700_000_000_000) !== 'yes') {
        if (!owesAnAccount(game)) break;
        game = fileReport(game);
        continue;
      }
      game = throwDie(game, intention).game;
    }

    return game;
  };

  it('says the question goes with the game', () => {
    const over = startOver(finished(), 4_242);

    expect(over.begun).toBe(true);
    expect(over.askAgain).toBe(true);
  });

  it('says nothing of the kind when the act is refused', () => {
    // A game still being played is not begun again, and a screen that cleared
    // the question on a refused act would empty it mid-game.
    const running = newGame(1_700_000_000_000);
    const refused = startOver(running, 4_242);

    expect(refused.begun).toBe(false);
    expect(refused.askAgain, 'nothing happened, so nothing is let go of').toBe(false);
    expect(refused.game).toBe(running);
  });

  it('leaves the new game unable to throw until it is asked again', () => {
    /**
     * The shape rather than the flag: whatever the screen does with `askAgain`,
     * a game begun again with no question must refuse the die — which is the
     * behaviour the gate has always had and the one the old question was
     * hiding.
     */
    const over = startOver(finished(), 4_242);

    expect(mayThrow(over.game, '', 1_700_000_000_000)).toBe('no-intention');
    expect(mayThrow(over.game, 'a question for the new game', 1_700_000_000_000)).toBe('yes');
  });
});

describe('the screen lets go of it in both places', () => {
  /**
   * A question cleared in the session's own store and left on the device comes
   * back at the next launch — the reason the screen writes to both when one is
   * answered, and the reason it has to clear both when the game is begun again.
   */
  const RESTART = APP.slice(APP.indexOf('const over = startOver('), APP.indexOf("'app.restarted'"));

  it('clears what it holds and what the device holds', () => {
    expect(RESTART).toContain("setIntention('')");
    expect(RESTART).toContain("saveIntention(store, '')");
    expect(RESTART).toContain("keepIntention(intentionKeeper, '')");
  });

  it('clears the box the question is typed into as well', () => {
    // `asking` is what the field shows. Left as it was, the new game opens with
    // the old sentence typed in, one tap from being answered again by accident.
    expect(RESTART).toContain("setAsking('')");
  });

  it('does it only when the act happened', () => {
    expect(RESTART).toMatch(/if \(over\.askAgain\)/);
  });
});
