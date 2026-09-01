import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  applyRoll,
  hasWon,
  initialState,
  isWaitingToEnter,
  seededRoller,
  type GameState,
  type Session,
} from '@leela/engine';
import { afterReport, join, openRoom, report, start, type Room } from '../src/commands';

/**
 * Square 68 means two different things, and this is the bot's half of the list.
 *
 * Two of the eight sightings were here, one command apart: `/report` filed an
 * account of Cosmic Consciousness for somebody who had never begun, and `/ask`
 * answered every question before the first six out of the winning square's
 * text.
 *
 * The engine states the rule over its own functions and the mini app over its
 * own. Here it is over the two decisions this surface makes about a player:
 * **whether their words may be filed, and what is true of them once they are.**
 */

const NOW = 1_700_000_000_000;
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

/** A table of two whose first seat is in one of the two states, and owes. */
function tableWith(state: GameState): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 4242).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  room = start(room, 'u1').room as Room;

  const session: Session = {
    ...room.session,
    players: room.session.players.map((seat, index) =>
      index === 0 ? { ...seat, state, reportSubmitted: false } : seat,
    ),
  };

  return { ...room, session };
}

describe('the two states that share a square, in the bot', () => {
  it('are what the engine leaves behind, not something written here', () => {
    expect(isWaitingToEnter(WAITING)).toBe(true);
    expect(hasWon(WON)).toBe(true);
    expect(WAITING.loka).toBe(WON.loka);
  });

  it('decide whether words may be filed at all', () => {
    // A winner owes an account of the square a whole game was played to reach.
    // Somebody who has not begun owes nothing, and has nowhere for it to go.
    const fromWaiting = report(tableWith(WAITING), 'u1', 'Something I felt like writing.', NOW);
    const fromWinner = report(tableWith(WON), 'u1', 'The last square, and what it asked.', NOW);

    expect(fromWaiting.effects ?? []).toEqual([]);
    expect(fromWinner.effects ?? []).toHaveLength(1);
    expect((fromWinner.effects ?? [])[0]).toMatchObject({ plan: 68 });
  });

  it('decide what is true of the player once they are', () => {
    expect(afterReport(tableWith(WON).session, 'u1', NOW)).toEqual({ say: 'finished' });
    expect(afterReport(tableWith(WAITING).session, 'u1', NOW)).not.toEqual({ say: 'finished' });
  });

  it('never let a square nobody stood on into a player’s own record', () => {
    // The rule the whole class comes down to on this surface. 68 is the one
    // plan that must never appear in a path without having been reached.
    for (const text of ['a', 'something longer', 'a whole paragraph about nothing at all']) {
      expect(report(tableWith(WAITING), 'u1', text, NOW).effects ?? [], text).toEqual([]);
    }
  });
});
