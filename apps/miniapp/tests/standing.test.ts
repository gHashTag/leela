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
import { canRoll, lineFor, standing } from '../src/view';

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

  it('stays live for a table where the seat holding the turn can still move', () => {
    // A winner does not end a table: `nextSeat` skips them and the rest play
    // on. The die belongs to the seat holding the turn, not to the finished.
    //
    // This test used to seat the winner *at* the turn and expect a live die,
    // which was the hole rather than the rule: `isSessionOver` is true only
    // once everybody has finished, so it left the die open to somebody who had
    // already reached Cosmic Consciousness.
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
      // The turn is the second seat's, which is where `nextSeat` puts it the
      // moment the first one finishes.
      turnIndex: 1,
      players: table.players.map((player, index) =>
        index === 0 ? { ...player, state: won } : player,
      ),
    };

    expect(hasWon(half.players[0]?.state as GameState)).toBe(true);
    expect(canRoll(half)).toBe(true);
  });

  it('is shut on a finished seat even while the rest of the table plays on', () => {
    // The rule is about the player, not the table. A seat that has reached
    // Cosmic Consciousness is done whether or not anybody else is.
    const table = createSession('test', [{ id: 'p1' }, { id: 'p2' }], CLASSIC);
    const won: GameState = {
      loka: WIN_LOKA,
      previous_loka: 51,
      direction: 'win 🕉',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: true,
    };

    const holdingTheTurn: Session = {
      ...table,
      turnIndex: 0,
      players: table.players.map((player, index) =>
        index === 0 ? { ...player, state: won } : player,
      ),
    };

    expect(isSessionOver(holdingTheTurn)).toBe(false);
    expect(canRoll(holdingTheTurn)).toBe(false);
  });
});

describe('an announcement, and the redraw that used to eat it', () => {
  /**
   * Four confirmations went missing at once and nobody noticed for four passes.
   *
   * The line under the board has three sources: a throw that just happened,
   * something the app was told to say, and where the player stands. For most of
   * this app's life there were two, and the second survived by accident —
   * nothing overwrote it. When the standing line arrived, every confirmation
   * written straight to the element just before a redraw was eaten by that
   * redraw: seats set, game restarted, intention held, path imported.
   *
   * So this is a class rather than four bugs, and the tests are about the class:
   * an announcement outlives any number of redraws and nothing else, and a
   * throw ends it.
   */
  const SAID = ['Seated 3.', 'A new game.', 'Held.', 'Took 4 plans.', ''];

  it('survives a redraw, which is the whole reason it exists', () => {
    for (const said of SAID) {
      const line = lineFor(said, false);
      expect(line.says, JSON.stringify(said)).toBe('announcement');
      expect(line.announcement, JSON.stringify(said)).toBe(said);
    }
  });

  it('survives any number of them', () => {
    // The defect was not one redraw: `announce` then `draw` then `draw` is the
    // ordinary life of this app, and a rule that only held once would be the
    // same bug one call later.
    let carried: string | null = 'Held.';

    for (let redraw = 0; redraw < 50; redraw++) {
      const line = lineFor(carried, false);
      expect(line.says, `redraw ${redraw}`).toBe('announcement');
      carried = line.announcement;
    }

    expect(carried).toBe('Held.');
  });

  it('ends on a throw, because a throw is the next thing happening', () => {
    for (const said of [...SAID, null]) {
      const line = lineFor(said, true);
      expect(line.says, JSON.stringify(said)).toBe('move');
      expect(line.announcement, JSON.stringify(said)).toBeNull();
    }
  });

  it('leaves the standing line to speak when nothing was announced', () => {
    expect(lineFor(null, false)).toEqual({ says: 'standing', announcement: null });
  });

  it('says exactly one thing, whatever it is handed', () => {
    // Three sources and one line: a rule that could pick two would be a rule
    // that picks whichever ran last, which is what this replaced.
    for (const said of [...SAID, null]) {
      for (const moved of [false, true]) {
        expect(['move', 'announcement', 'standing']).toContain(lineFor(said, moved).says);
      }
    }
  });
});
