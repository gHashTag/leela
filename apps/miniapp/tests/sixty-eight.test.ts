import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  WIN_LOKA,
  applyRoll,
  createSession,
  hasWon,
  initialState,
  isWaitingToEnter,
  seededRoller,
  type GameState,
  type Session,
} from '@leela/engine';
import { owingSeat, seatOwesReport } from '../src/reports';
import { isSavedGame } from '../src/state';
import { canRoll, headline, mayThrow, standing } from '../src/view';

/**
 * Square 68 means two different things, and this is the mini app's half of the
 * list of everything that has to tell them apart.
 *
 * A player who has not entered sits on `WIN_LOKA` with `is_finished` set, and so
 * does a player who has just won. The board cannot distinguish them; only the
 * history can. Three of the eight times this has been found were here — the
 * header reset to "—" at the moment of winning, the line underneath told a
 * winner *"a six puts you on the board"*, and the die stayed live for a seat
 * that had finished.
 *
 * The engine states the rule over its own functions. This states it over the
 * decisions a player actually meets: **every answer this app gives about a
 * player must be a different answer for these two states, or say why not.**
 */

const WAITING: GameState = initialState();

/** A game played to its end, so the winning state is one a game produced. */
function playedToTheEnd(): GameState {
  for (let seed = 1; seed <= 200; seed += 1) {
    let state = initialState();
    const die = seededRoller(seed);

    for (let turn = 0; turn < 400; turn += 1) {
      state = applyRoll(state, die(), CLASSIC).state;
      if (hasWon(state)) return state;
    }
  }

  throw new Error('no seed reached Cosmic Consciousness');
}

const WON = playedToTheEnd();

/** One seat, in one of the two states, holding the turn. */
function seated(state: GameState, reportSubmitted = true): Session {
  const session = createSession('device', [{ id: 'p1' }], CLASSIC);
  return {
    ...session,
    players: session.players.map((player) => ({ ...player, state, reportSubmitted })),
  };
}

const titleOf = (plan: number) => `title ${plan}`;

/**
 * Each answer, and what it has to be for each of the two states.
 *
 * Written out rather than compared to each other, which was this file's first
 * mistake: "the two answers differ" passes when *both* are wrong. Deleting the
 * winner's branch from `standing` left a winner being told they are standing on
 * plan 68 — still different from the waiting player's sentence, still a lie —
 * and the first version of this table went green on it.
 */
const ASKED: Array<{
  what: string;
  ask: (state: GameState) => unknown;
  waiting: unknown;
  won: unknown;
  same?: string;
}> = [
  {
    what: 'standing — the line under the board',
    ask: (state) => standing(state, false, titleOf).key,
    waiting: 'app.opening',
    won: 'app.finished',
  },
  {
    what: 'headline — the number shown',
    ask: (state) => headline(state, 'en', titleOf).number,
    waiting: '—',
    won: String(WIN_LOKA),
  },
  {
    what: 'headline — whether the board is drawn as a pause',
    ask: (state) => headline(state, 'en', titleOf).waiting,
    waiting: true,
    won: false,
  },
  {
    what: 'headline — the progress bar',
    ask: (state) => headline(state, 'en', titleOf).progress,
    waiting: 0,
    won: WIN_LOKA,
  },
  {
    what: 'canRoll — whether the die is this seat’s to throw',
    ask: (state) => canRoll(seated(state)),
    waiting: true,
    won: false,
  },
  {
    what: 'mayThrow — and why not',
    ask: (state) => mayThrow(seated(state), 'to see it through', false, false),
    waiting: 'yes',
    won: 'finished',
  },
  {
    what: 'seatOwesReport — whether the game is asking for an account',
    ask: (state) => seatOwesReport({ state, reportSubmitted: false }),
    waiting: false,
    won: true,
  },
  {
    what: 'owingSeat — whose the writing box is',
    ask: (state) => owingSeat(seated(state, false).players, 0)?.id ?? null,
    waiting: null,
    won: 'p1',
  },
  {
    what: 'isSavedGame — whether storage may be trusted',
    ask: (state) => isSavedGame(state),
    waiting: true,
    won: true,
    same:
      'Both are states the engine can produce, so both must survive a reload. ' +
      'A validator that refused one of them would throw away either every new ' +
      'game or every finished one.',
  },
];

describe('the two states that share a square, in the mini app', () => {
  it('are both on 68 and both finished, as the engine leaves them', () => {
    expect(WAITING.loka).toBe(WIN_LOKA);
    expect(WON.loka).toBe(WIN_LOKA);
    expect(isWaitingToEnter(WAITING)).toBe(true);
    expect(hasWon(WON)).toBe(true);
  });

  it('get the answer each of them is owed', () => {
    for (const asked of ASKED) {
      expect(asked.ask(WAITING), `${asked.what} — waiting`).toEqual(asked.waiting);
      expect(asked.ask(WON), `${asked.what} — won`).toEqual(asked.won);
    }
  });

  it('are told apart by everything that has not argued otherwise', () => {
    for (const asked of ASKED) {
      if (asked.same) continue;

      expect(asked.ask(WAITING), asked.what).not.toEqual(asked.ask(WON));
    }
  });

  it('have a written reason wherever they are not', () => {
    for (const asked of ASKED) {
      if (!asked.same) continue;

      expect(asked.same.length, asked.what).toBeGreaterThan(40);
      expect(asked.ask(WAITING), asked.what).toEqual(asked.ask(WON));
    }
  });

  it('never leave a winner being told how to enter', () => {
    // The fifth sighting, stated as its own line because it is the one a player
    // meets at the end of a whole game.
    expect(standing(WON, false, titleOf).key).not.toBe('app.opening');
    expect(standing(WAITING, false, titleOf).key).toBe('app.opening');
  });

  it('never leave a winner holding a live die', () => {
    // The eighth. `canRoll` asked about the table, not the seat.
    expect(canRoll(seated(WON))).toBe(false);
    expect(canRoll(seated(WAITING))).toBe(true);
  });
});
