import { describe, expect, it } from 'vitest';
import { CLASSIC, advance, submitReport } from '@leela/engine';
import { newGame, standingOn, throwDie, type Game } from '../src/game';
import { GAME_KEY, keepGame, loadKeptGame } from '../src/game-store';
import type { Keeper } from '../src/journal';

/**
 * The board, between two launches.
 *
 * This app kept what a player wrote and lost where they were standing. The
 * journal survived a restart and the intention survived a restart; the game did
 * not — `useState(() => newGame(startingSeed()))` made a fresh one with a random
 * seed every time. So somebody who had climbed to plan 41 came back to the
 * waiting square needing a six to begin, with a year of their own writing
 * intact underneath, about squares they were no longer on.
 *
 * The record the game exists to produce was kept, and the game was not. This
 * repository has met that shape from the other side five times — a report
 * written and never read back — and this is the first time it has been the
 * board.
 *
 * **`game.ts` already promised otherwise.** *The die is `(seed, rollsTaken)`, so
 * a game replays exactly from two numbers a player can carry away.* Both were
 * computed and thrown away. What is asserted here is that promise, kept.
 */

/** A device that answers, and remembers what it was told. */
const disk = (): Keeper & { held: string | null } => {
  const it = {
    held: null as string | null,
    async read() {
      return it.held;
    },
    async write(value: string) {
      it.held = value;
      return true;
    },
  };
  return it;
};

/** A device that refuses, which is what a full one looks like. */
const refuses = (): Keeper => ({
  async read() {
    return null;
  },
  async write() {
    throw new Error('the disk is full');
  },
});

/** A player who has entered the game and walked a little way. */
function played(seed: number, rolls: readonly number[]): Game {
  let game = newGame(seed);
  for (const _ of rolls) {
    // Through the app's own `throwDie`, so what is kept is a state the app can
    // actually produce. The gate is answered between throws, as a player does.
    const before = standingOn(game);
    game = throwDie(game, 'a question').game;
    if (standingOn(game) !== before) {
      game = { ...game, session: submitReport(game.session, 'p1', Date.now()) };
    }
  }
  return game;
}

describe('a game comes back where it was left', () => {
  it('keeps the square, and it is not the waiting one', () => {
    // The defect as one assertion: before this, a relaunch was always 68.
    const device = disk();
    const game = played(7, [1, 2, 3, 4, 5, 6, 7, 8]);

    return keepGame(device, game)
      .then(() => loadKeptGame(device))
      .then((kept) => kept.game)
      .then((back) => {
        expect(back).not.toBe(null);
        expect(standingOn(back as Game)).toBe(standingOn(game));
        expect(standingOn(back as Game), 'a game that was played').not.toBe(68);
      });
  });

  it('keeps whether an account is still owed', () => {
    // Not derivable from the die. Whether a player has written about the square
    // they are on is a fact about them, so it travels with the state or the
    // gate opens itself overnight.
    const device = disk();
    const owing = { ...newGame(3), session: advance(newGame(3).session, 6, Date.now()).session };

    return keepGame(device, owing)
      .then(() => loadKeptGame(device))
      .then((kept) => kept.game)
      .then((back) => {
        expect(back?.session.players[0]?.reportSubmitted).toBe(
          owing.session.players[0]?.reportSubmitted,
        );
      });
  });

  it('continues the die rather than starting it again', () => {
    /**
     * The half that is easy to get wrong and invisible when it is: rebuild the
     * roller from the seed and hand it back unturned, and the next throw is the
     * *first* throw of the game — so a player sees their opening roll again on
     * every relaunch, and the sequence is played twice instead of continued.
     */
    const device = disk();
    const game = played(11, [1, 2, 3]);

    /** The next few throws of a game, without changing it. */
    const nextThree = (from: Game): number[] => {
      const rolls: number[] = [];
      let walking = from;
      for (let turn = 0; turn < 3; turn += 1) {
        const thrown = throwDie(walking, 'a question');
        rolls.push(thrown.roll);
        walking = { ...thrown.game, session: submitReport(thrown.game.session, 'p1', Date.now()) };
      }
      return rolls;
    };

    // What the game would have gone on to throw, had the app never closed.
    const continued = nextThree(game);

    return keepGame(device, game)
      .then(() => loadKeptGame(device))
      .then((kept) => kept.game)
      .then((back: Game | null) => {
        expect(nextThree(back as Game)).toEqual(continued);
        // A sequence rather than one value: any single throw may coincide with
        // the opening one by luck, and an assertion that can pass by luck is one
        // that will fail by luck too.
        expect(nextThree(back as Game), 'and not the game played over again').not.toEqual(
          nextThree(newGame(11)),
        );
      });
  });

  it('carries the two numbers the file promises', () => {
    const device = disk();
    const game = played(5, [1, 2]);

    return keepGame(device, game)
      .then(() => loadKeptGame(device))
      .then((kept) => kept.game)
      .then((back) => {
        expect(back?.seed).toBe(game.seed);
        expect(back?.rollsTaken).toBe(game.rollsTaken);
      });
  });

  it('does not carry yesterday’s throw', () => {
    // The last event is a sentence about something that already happened. A
    // player opening the app tomorrow is told where they are, not what they
    // rolled.
    const device = disk();

    return keepGame(device, played(5, [1, 2]))
      .then(() => loadKeptGame(device))
      .then((kept) => kept.game)
      .then((back) => expect(back?.event).toBe(null));
  });
});

describe('what a device that will not answer means', () => {
  it('begins a game rather than restoring half of one', () => {
    // Null, never a partly-built board. A game that came back wrong is worse
    // than one that came back empty, because only one of them is visible.
    //
    // Collected rather than awaited in the loop. Each of these six lines used
    // to be written straight into the loop body under an
    // `eslint-disable-next-line no-await-in-loop`, with no `await` beneath it —
    // the suppression outlived the statement it was suppressing. Vitest still
    // caught a wrong value, because it auto-awaits assertions left hanging at
    // the end of a test, and it printed six warnings saying it will stop doing
    // that. So the test was correct only for as long as that rescue lasts, and
    // `scripts/audit-awaited.mjs` now reads every test for the same shape.
    return Promise.all(
      ['half a write{', 'null', '42', '{"seed":1}', '{}', '[]'].map((rubbish) => {
        const device: Keeper = { async read() { return rubbish; }, async write() { return true; } };
        return expect(loadKeptGame(device).then((kept) => kept.game), rubbish).resolves.toBe(null);
      }),
    );
  });

  it('refuses a saved game whose seat has no square', () => {
    // The shape of a state, not a list of the fields somebody remembered: a
    // session with players that carry no `loka` is not a game this app can draw.
    const device: Keeper = {
      async read() {
        return JSON.stringify({ seed: 1, rollsTaken: 0, session: { players: [{ id: 'p1' }] } });
      },
      async write() {
        return true;
      },
    };

    return expect(loadKeptGame(device).then((kept) => kept.game)).resolves.toBe(null);
  });

  it('says the game was not kept when the device refuses', () => {
    return expect(keepGame(refuses(), newGame(1))).resolves.toBe(false);
  });

  it('has nothing to restore when there is no device at all', () => {
    return Promise.all([
      expect(loadKeptGame(undefined).then((kept) => kept.game)).resolves.toBe(null),
      expect(keepGame(undefined, newGame(1))).resolves.toBe(false),
    ]);
  });

  it('gives up on a device that never answers', () => {
    // `Keeper` is an injection point and nothing in its type says it returns.
    // The journal learned this; the game is held to the same clock.
    const silent: Keeper = { read: () => new Promise(() => {}), write: () => new Promise(() => {}) };

    return Promise.all([
      expect(loadKeptGame(silent, CLASSIC, 10).then((kept) => kept.game)).resolves.toBe(null),
      expect(keepGame(silent, newGame(1), 10)).resolves.toBe(false),
    ]);
  });
});

describe('the game and the path are kept apart', () => {
  it('uses a key of its own', () => {
    // Two things in one slot overwrite each other, and the one that loses is
    // whichever was written first. The journal's key is `leela.reports.v1`.
    expect(GAME_KEY).toBe('leela.game.v1');
    expect(GAME_KEY).not.toBe('leela.reports.v1');
  });
});
