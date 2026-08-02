/**
 * A loss that reads exactly like an absence.
 *
 * The app reads two things off the disk when it opens: the path and the board.
 * Both discarded what they could not use and said nothing about it.
 *
 * Measured before anything changed. Eight accounts written to the store, three
 * of them damaged: five came back, and `load` had no way to mention the other
 * three — a path three accounts short looks precisely like a path three
 * accounts were never written into. The board was worse. `loadKeptGame`
 * answered `null` to *nothing has ever been saved* and to *there is a file here
 * and it cannot be played*, and the screen treated them alike: begin a fresh
 * game, say nothing. Which is the sentence `game-store.ts` opens with, as the
 * reason it exists — a player back on the waiting square with a year of their
 * own writing intact underneath, about squares they are no longer on.
 *
 * The rule these assert is not "three entries" or "this one bad file". It is
 * that **what was on the disk and is not on the screen is reported**: for any
 * file, the count that comes back plus the count reported as lost is the count
 * that was written, and a board is called unreadable exactly when there was one
 * to read and it could not be.
 */

import { describe, expect, it } from 'vitest';
import { CLASSIC, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { read } from '../src/journal';
import { loadKeptGame } from '../src/game-store';

const account = (plan: number) => ({
  plan,
  text: `something written about plan ${plan}`,
  at: 1_700_000_000_000 + plan,
});

/** Entries no reader of this format accepts, one of each shape it refuses. */
const damaged: unknown[] = [
  { plan: 900, text: 'a square nobody has stood on', at: 1 },
  { plan: 0, text: 'nor that one', at: 1 },
  { plan: TOTAL_PLANS + 1, text: 'nor the one after the end', at: 1 },
  { plan: 4 },
  { plan: 4, text: '', at: 1 },
  { plan: 4, text: 'a moment that is not one', at: 1.5 },
  { plan: 4, text: 'nor a moment before time', at: -1 },
  { plan: 4, text: 'no moment', at: 'yesterday' },
  'not an entry',
  null,
  42,
];

const storeOf = (raw: string) => ({ getItem: () => raw, setItem: () => undefined });

const fileOf = (entries: unknown[]) =>
  storeOf(JSON.stringify({ entries }));

describe('the path, read back off the disk', () => {
  it('accounts for every entry that was written', () => {
    // The shape: kept + dropped = written, whatever the file holds. A reader
    // that silently filtered would satisfy `kept` alone.
    const unaccounted: string[] = [];

    for (let bad = 0; bad <= damaged.length; bad += 1) {
      for (const good of [0, 1, 5]) {
        const entries = [
          ...Array.from({ length: good }, (_, at) => account(at + 1)),
          ...damaged.slice(0, bad),
        ];

        const back = read(fileOf(entries));
        if (back.journal.entries.length + back.dropped !== entries.length) {
          unaccounted.push(
            `${good} good and ${bad} damaged: ${back.journal.entries.length} kept, ` +
              `${back.dropped} reported, ${entries.length} written`,
          );
        }
      }
    }

    expect(unaccounted).toEqual([]);
  });

  it('reports nothing lost when nothing was', () => {
    // Otherwise the count above could be satisfied by calling everything lost.
    const back = read(fileOf([account(1), account(2), account(3)]));

    expect(back.dropped).toBe(0);
    expect(back.journal.entries).toHaveLength(3);
  });

  it('calls a file that is not a path an absence, not a loss', () => {
    // There is no count to give and the player has written nothing this is
    // about. Saying "some of your accounts were lost" here would be a lie.
    for (const raw of ['not json at all', '42', 'null', '{"entries":"none"}', '{}']) {
      expect(read(storeOf(raw))).toEqual({ journal: { entries: [] }, dropped: 0 });
    }
  });

  it('reports the loss even when nothing at all survived it', () => {
    const back = read(fileOf(damaged));

    expect(back.journal.entries).toEqual([]);
    expect(back.dropped).toBe(damaged.length);
  });
});

const gameFile = (raw: string | null) => ({
  read: async () => raw,
  write: async () => true,
});

const playable = {
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
};

describe('the board, read back off the disk', () => {
  it('tells a game that could not be read from a game that was never saved', async () => {
    expect(await loadKeptGame(gameFile(null) as never)).toEqual({
      game: null,
      unreadable: false,
    });
    expect(await loadKeptGame(undefined)).toEqual({ game: null, unreadable: false });
  });

  it('calls every file it refuses a game that was lost', async () => {
    // One per door out of the loader: broken JSON, a shape no game reaches, a
    // variant nobody defines. Each of them is a board somebody was standing on.
    const refused: Array<[string, unknown]> = [
      ['half a write', '{"seed":7,"rollsTaken"'],
      ['not a game at all', JSON.stringify({ seed: 7 })],
      ['a plan off the board', JSON.stringify(seatedOn({ loka: 999 }))],
      ['finished somewhere else', JSON.stringify(seatedOn({ loka: 41, is_finished: true }))],
      ['a turn pointing at nobody', JSON.stringify(turnedTo(7))],
      ['a variant nobody defines', JSON.stringify(under({ id: 'housebound' }))],
    ];

    for (const [name, raw] of refused) {
      const kept = await loadKeptGame(gameFile(raw as string) as never);
      expect({ name, ...kept }).toEqual({ name, game: null, unreadable: true });
    }
  });

  it('still says nothing about a game it could read', async () => {
    const kept = await loadKeptGame(gameFile(JSON.stringify(playable)) as never);

    expect(kept.unreadable).toBe(false);
    expect(kept.game?.session.players[0]?.state.loka).toBe(10);
  });

  it('says nothing when the device never answered', async () => {
    // Nothing is known about what is on the disk, so nothing is known to be
    // lost. A silent device is a game that cannot be continued now, not one
    // that has gone.
    const silent = { read: () => new Promise<string | null>(() => undefined), write: async () => true };

    expect(await loadKeptGame(silent as never, CLASSIC, 10)).toEqual({
      game: null,
      unreadable: false,
    });
  });
});

function seatedOn(over: Record<string, unknown>) {
  const [seat] = playable.session.players;
  return {
    ...playable,
    session: {
      ...playable.session,
      players: [{ ...seat, state: { ...seat?.state, ...over } }],
    },
  };
}

function turnedTo(turnIndex: number) {
  return { ...playable, session: { ...playable.session, turnIndex } };
}

function under(rules: unknown) {
  return { ...playable, session: { ...playable.session, rules } };
}

describe('the two of them together', () => {
  it('agree about what the win square is, so a finished game is not a loss', async () => {
    // Guards the pair above against drifting: `is_finished` on the win square
    // is a game somebody completed, and reading it back must not report it as
    // a board that could not be read.
    const finished = seatedOn({ loka: WIN_LOKA, is_finished: true });
    const kept = await loadKeptGame(gameFile(JSON.stringify(finished)) as never);

    expect(kept.unreadable).toBe(false);
    expect(kept.game).not.toBeNull();
  });
});
