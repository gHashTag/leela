/**
 * A device that did not answer is not a device with nothing on it.
 *
 * The pass before this taught the app to adopt the game the published
 * application left on the phone — it installs over that app, into the same
 * store, and had read nothing of what was there. The condition was *this app
 * has none of its own*, and `loadKeptGame` answered that to three different
 * situations: the slot is empty, the read threw, and **the read did not come
 * back within five seconds**.
 *
 * `within` returns its fallback on a timeout, and the fallback was `null` —
 * the same word the store returns for an empty slot. So a slow disk said *none
 * of its own*, the old board went on the screen, and the next throw wrote it
 * over the game this app really had.
 *
 * The timing is the worst there is. The inheritance runs on the first launch
 * after an update, which is when a phone's storage is busiest.
 *
 * The rule these assert is not about five seconds. It is that **a silence is
 * carried as a silence**: whatever the device does or does not say, the app
 * only adopts somebody else's game when this one has been told there is
 * nothing of its own.
 */

import { describe, expect, it } from 'vitest';
import { CLASSIC } from '@leela/engine';
import { loadKeptGame } from '../src/game-store';
import type { Keeper } from '../src/journal';

const playable = JSON.stringify({
  seed: 7,
  rollsTaken: 3,
  session: {
    id: 's',
    turnIndex: 0,
    rollCount: 3,
    rules: CLASSIC,
    players: [
      {
        id: 'a',
        state: {
          loka: 10,
          previous_loka: 4,
          direction: 'step 🚶🏼',
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: false,
        },
        lastRollAt: null,
        lastReportAt: null,
        reportSubmitted: true,
      },
    ],
  },
});

/** Every way a store can behave, and what the app is entitled to conclude. */
const stores: Array<[string, Keeper, { answered: boolean; game: boolean }]> = [
  [
    'says it holds nothing',
    { read: async () => null, write: async () => true },
    { answered: true, game: false },
  ],
  [
    'holds a game',
    { read: async () => playable, write: async () => true },
    { answered: true, game: true },
  ],
  [
    'holds something that is not one',
    { read: async () => 'half a wri', write: async () => true },
    { answered: true, game: false },
  ],
  [
    'never answers',
    { read: () => new Promise<string | null>(() => undefined), write: async () => true },
    { answered: false, game: false },
  ],
  [
    'refuses',
    {
      read: () => Promise.reject(new Error('the store is not available')),
      write: async () => true,
    },
    { answered: false, game: false },
  ],
];

describe('what a phone says about the game it is keeping', () => {
  it('is told apart from what it does not say', async () => {
    const wrong: string[] = [];

    for (const [what, keeper, expected] of stores) {
      const kept = await loadKeptGame(keeper, CLASSIC, 20);
      const got = { answered: kept.answered, game: kept.game !== null };

      if (got.answered !== expected.answered || got.game !== expected.game) {
        wrong.push(`a store that ${what}: ${JSON.stringify(got)}`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it('is a silence when there was nothing to ask', async () => {
    // No store at all. The app knows nothing about this phone, which is not the
    // same as knowing the phone holds nothing.
    expect(await loadKeptGame(undefined)).toMatchObject({ answered: false, game: null });
  });

  it('is an answer the moment the store gives one, however empty', async () => {
    // Otherwise the rule above is satisfiable by never trusting the store, and
    // a player who really has no game would never be given the old one.
    const empty = await loadKeptGame({ read: async () => null, write: async () => true }, CLASSIC, 20);

    expect(empty).toMatchObject({ answered: true, game: null, unreadable: false });
  });

  it('does not turn a slow answer into an empty one', async () => {
    // The failure exactly: a store that would have said "here is your game" in
    // six seconds. Nothing this app does may depend on the difference between
    // that and an empty phone — except by knowing it did not hear.
    const slow: Keeper = {
      read: () => new Promise<string | null>((resolve) => setTimeout(() => resolve(playable), 200)),
      write: async () => true,
    };

    const hurried = await loadKeptGame(slow, CLASSIC, 20);
    expect(hurried).toMatchObject({ answered: false, game: null });

    const waited = await loadKeptGame(slow, CLASSIC, 2000);
    expect(waited.answered).toBe(true);
    expect(waited.game?.session.players[0]?.state.loka).toBe(10);
  });

  it('keeps a game whose stored text is the empty string', async () => {
    // A slot holding `''` is a slot that was written to. It is not a game, and
    // it is not a silence either — this app has something of its own to be
    // wrong about, and must not be handed the published app's board instead.
    const kept = await loadKeptGame({ read: async () => '', write: async () => true }, CLASSIC, 20);

    expect(kept.answered).toBe(true);
    expect(kept.game).toBeNull();
  });
});
