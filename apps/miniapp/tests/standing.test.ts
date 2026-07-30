import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  TOTAL_PLANS,
  WIN_LOKA,
  advance,
  createSession,
  hasWon,
  isSessionOver,
  isWaitingToEnter,
  seededRoller,
  type GameState,
  type RuleSet,
  type Session,
} from '@leela/engine';
import { canRoll, standing } from '../src/view';

/**
 * The line under the board, and the state it claims to describe.
 *
 * `app.opening` — "a six puts you on the board" — was written into the page
 * once, at build time, and replaced only by a move or by the report gate. So
 * every player who closed the app and came back was greeted with the
 * instruction for somebody who has never entered: standing on 30, six squares
 * of history behind them, told how to begin.
 *
 * At the other end it was worse. A player who reached Cosmic Consciousness —
 * the whole point of the game — reopened the app to the same sentence, and
 * rolling produced *"It takes a six to enter the game"*, because a waiting
 * player and a finished one sit on the same square with the same flag and
 * their refused throws are the same event. The engine's own helper for telling
 * refusals apart could not tell those two apart; the event now carries it.
 *
 * The rule here is not the two sentences that were wrong. It is: **the line
 * describes the state the player is in** — checked over states the engine
 * actually produced, not states a test author thought to write down.
 */

/**
 * Every session a real game passes through, played rather than constructed.
 *
 * Stops where the engine stops: `advance` refuses a session in which everybody
 * has finished, so a game played past its end is not a game this app can be in.
 */
function playedGame(rules: RuleSet, seed: number, throws: number): Session[] {
  let session = createSession('test', [{ id: 'p1' }], rules);
  const roll = seededRoller(seed);
  const seen: Session[] = [session];

  for (let n = 0; n < throws && !isSessionOver(session); n++) {
    const moved = advance(session, roll(), n);
    // The gate would otherwise stop the game after one throw, and this file is
    // about the sentence rather than about the gate.
    session = {
      ...moved.session,
      players: moved.session.players.map((player) => ({ ...player, reportSubmitted: true })),
    };
    seen.push(session);
  }

  return seen;
}

const stateOf = (session: Session): GameState => session.players[0]?.state as GameState;

function playedStates(rules: RuleSet, seed: number, throws: number): GameState[] {
  return playedGame(rules, seed, throws).map(stateOf);
}

const titleOf = (plan: number) => `title ${plan}`;

/** The states, and the one key each of them is owed. */
function expected(state: GameState, owed: boolean): string {
  if (owed) return 'app.reportNeeded';
  if (hasWon(state)) return 'app.finished';
  if (isWaitingToEnter(state)) return 'app.opening';
  return 'app.standing';
}

describe('the line under the board describes the state the player is in', () => {
  const GAMES = [1, 2, 3, 7, 11, 42].flatMap((seed) =>
    [CLASSIC, LEGACY_MOBILE].map((rules) => ({ seed, rules })),
  );

  it('never tells a player how to enter a game they are already in', () => {
    // The shape of the defect, stated once: `app.opening` is an instruction for
    // somebody off the board, and nobody else may be shown it.
    for (const { seed, rules } of GAMES) {
      for (const state of playedStates(rules, seed, 60)) {
        const line = standing(state, false, titleOf);
        if (line.key === 'app.opening') {
          expect(isWaitingToEnter(state), `seed ${seed} on ${state.loka}`).toBe(true);
        }
      }
    }
  });

  it('never tells a player how to enter a game they have completed', () => {
    for (const { seed, rules } of GAMES) {
      for (const state of playedStates(rules, seed, 60)) {
        if (!hasWon(state)) continue;
        expect(standing(state, false, titleOf).key, `seed ${seed}`).toBe('app.finished');
      }
    }
  });

  it('says exactly one true thing about every state a game produces', () => {
    for (const { seed, rules } of GAMES) {
      for (const state of playedStates(rules, seed, 60)) {
        for (const owed of [false, true]) {
          expect(standing(state, owed, titleOf).key, `${seed} ${state.loka} ${owed}`).toBe(
            expected(state, owed),
          );
        }
      }
    }
  });

  it('names the square a player in play is standing on', () => {
    // The line replaces an instruction with a fact, so the fact has to be
    // theirs: a number and the title of that number, not of another.
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const state: GameState = {
        loka: plan,
        previous_loka: 1,
        direction: 'step 🚶🏼',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: false,
      };

      const line = standing(state, false, titleOf);
      expect(line.key).toBe('app.standing');
      expect(line.params).toEqual({ plan, title: `title ${plan}` });
    }
  });
});

describe('the die, once the game is complete', () => {
  it('is offered exactly while the engine would accept a throw', () => {
    // The rule stated as the engine states it. A die the game will refuse is
    // not a choice — `advance` throws on a finished session, so the click that
    // looked available raised an error out of the handler and did nothing.
    for (const rules of [CLASSIC, LEGACY_MOBILE]) {
      for (const session of playedGame(rules, 5, 60)) {
        expect(canRoll(session), `${rules.id} on ${stateOf(session).loka}`).toBe(
          !isSessionOver(session),
        );
      }
    }
  });

  it('stays live while anybody at the table can still move', () => {
    // A winner does not end a table: `nextSeat` skips them and the rest play
    // on. The die belongs to the seat holding the turn, not to the finished.
    const table = createSession('test', [{ id: 'p1' }, { id: 'p2' }], CLASSIC);
    const won: GameState = {
      loka: WIN_LOKA,
      previous_loka: 51,
      direction: 'win 🕉',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: true,
    };

    const half: Session = {
      ...table,
      players: table.players.map((player, index) =>
        index === 0 ? { ...player, state: won } : player,
      ),
    };

    expect(hasWon(half.players[0]?.state as GameState)).toBe(true);
    expect(canRoll(half)).toBe(true);
  });
});
