/**
 * A game on a phone, moved by the engine and by nothing else.
 *
 * The app this replaces carried its own movement: `GameService.ts` in
 * `NeuroLeelaExpo` is four hundred and seventy-one lines, of which
 * `getDirectionAndPosition` and `handleConsecutiveSixes` decide where a throw
 * puts a player. That is the fifth copy of the board's rules in this family of
 * repositories — after the published app, the Expo rewrite, the Solidity
 * contract and the mini app — and every copy has been a place for the game to
 * become a different game without anybody saying so.
 *
 * `@leela/engine` is the one that is tested to the last branch. So this module
 * holds **no rule at all**: not the entering six, not the snakes, not the three
 * sixes, not the win. It holds a seat, a die and what the last throw did, and
 * `advance` does the rest.
 *
 * `no-rules.test.ts` asserts that, over the source rather than over a promise.
 */

import {
  CLASSIC,
  advance,
  canCurrentPlayerRoll,
  createSession,
  currentPlayer,
  isSessionOver,
  owesReport,
  seededRoller,
  submitReport,
  type TurnBlockedReason,
  type MoveEvent,
  type RuleSet,
  type Session,
} from '@leela/engine';

/** One player on one device. A shared table is the bot's business. */
const SEAT = 'p1';

export interface Game {
  session: Session;
  /** The die itself, seeded once and turned in order. */
  die: () => number;
  /** How many throws have been taken, so a game replays from its seed. */
  rollsTaken: number;
  /** What the last throw did, for the sentence under the board. */
  event: MoveEvent | null;
  /** The rules being played. Named, never assumed: variants differ. */
  rules: RuleSet;
  seed: number;
}

export function newGame(seed: number, rules: RuleSet = CLASSIC): Game {
  return {
    session: createSession('device', [{ id: SEAT, name: 'You' }], rules),
    die: seededRoller(seed),
    rollsTaken: 0,
    event: null,
    rules,
    seed,
  };
}

/** The plan the player is standing on. */
export function standingOn(game: Game): number {
  return currentPlayer(game.session).state.loka;
}

/**
 * Why the die may not turn, or `yes`.
 *
 * A reason rather than a boolean, and in the order a player meets them: the
 * question the game is played to answer, then the account it asks for, then the
 * end of the game. A dimmed control with no explanation is the app ending
 * somebody's game without saying so.
 *
 * **The question comes first, and this surface did not ask it.** The published
 * app will not let anyone near the board without one —
 * `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
 * in `screens/helper.ts`, with the back gesture blocked — and the mini app's
 * `mayThrow` refuses a throw for the same reason. The phone let a player
 * straight to the die, so the same game on the same board asked a different
 * thing of them depending on what they held it in.
 *
 * Asked here and asked again by `throwDie`, because a disabled button is a
 * drawing and a drawing refuses nothing — the lesson the mini app learned from
 * a double tap that filed two accounts of one square.
 */
export type ThrowRefusal = 'yes' | 'no-intention' | TurnBlockedReason;

export function mayThrow(game: Game, intention: string, now = Date.now()): ThrowRefusal {
  // The question first: it is the surface's to ask, because the engine has no
  // idea one exists — the bot keeps it per player, the mini app per seat, and
  // this app in its own key.
  if (intention.trim() === '') return 'no-intention';

  // And then the engine's own answer, rather than a second one written here.
  // The mini app and this app each had a `mayThrow` that re-decided
  // `report-required` and `finished` under new names, while the bot asked
  // `canCurrentPlayerRoll` — three surfaces, one question, and only one of them
  // asking it. That is how this app came to have no intention gate at all: a
  // decision written out by hand is a decision each surface writes differently.
  const verdict = canCurrentPlayerRoll(game.session, now);
  return verdict.allowed ? 'yes' : (verdict.reason ?? 'yes');
}

/**
 * Whether the game is finished.
 *
 * `isSessionOver` is every seat, which is the right question for a table and
 * the wrong one for a throw: it was in `mayThrow` until the engine learned to
 * say `finished` itself, and at a shared table it would have left the die open
 * to somebody who had already arrived.
 */
export function isOver(game: Game): boolean {
  return isSessionOver(game.session);
}

/**
 * Take a throw.
 *
 * The die is `(seed, rollsTaken)`, so a game replays exactly from two numbers
 * a player can carry away — and nobody has to take another player's word for a
 * throw. Where the throw lands is `advance`'s answer, never this file's.
 */
export function throwDie(game: Game, intention: string): { game: Game; roll: number } {
  if (mayThrow(game, intention) !== 'yes') return { game, roll: 0 };

  const roll = game.die();
  const moved = advance(game.session, roll, Date.now());

  return {
    game: { ...game, session: moved.session, rollsTaken: game.rollsTaken + 1, event: moved.event },
    roll,
  };
}

/**
 * Whether the game is waiting for an account of this square.
 *
 * Two facts, and both are the engine's: the arrival owes one, and the seat has
 * not given it. The mini app was caught keeping a second record of the second
 * fact and the two disagreed the moment a player sat down, so there is one here
 * and it is `reportSubmitted` on the seat.
 */
export function owesAnAccount(game: Game): boolean {
  const seat = currentPlayer(game.session);
  return owesReport(seat.state, game.rules) && !seat.reportSubmitted;
}

/** File one, which is what opens the die again. */
export function fileReport(game: Game): Game {
  return { ...game, session: submitReport(game.session, SEAT, Date.now()) };
}
