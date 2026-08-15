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
  isWaitingToEnter,
  owesReport,
  rollerFor,
  seededRoller,
  submitReport,
  type TurnBlockedReason,
  type MoveEvent,
  type RuleSet,
  type Session,
} from '@leela/engine';
import { seatId } from '@leela/journal';

/**
 * One player on one device. A shared table is the bot's business.
 *
 * Derived, not copied: the journal names the seats, and a literal `'p1'` here
 * was the same value written out a third time — true until the day it is not,
 * with a player's path still on the disk under a name nothing asks for.
 */
const SEAT = seatId(0);

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
    // The variant's own die, not a bare one.
    //
    // This said `seededRoller(seed)` and took the rules for everything else,
    // so a game under `legacy-mobile` or `online` — both of which re-roll a
    // repeat — rolled a plain die while calling itself that variant. The bot
    // and the mini app have always gone through `rollerFor`; this app reads its
    // ruleset out of the store, which is how a player brought across from the
    // published app arrives holding `legacy-mobile`.
    //
    // `rerollOnRepeat` is the field this repository once found declared, set
    // correctly everywhere and consulted by nothing. It is consulted here now.
    // Under `CLASSIC` and `neuroleela` the flag is false and `rollerFor` hands
    // the same die straight back, so nothing changes for a game in play today.
    die: rollerFor(rules, seededRoller(seed)),
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
 * The square whose text belongs on screen, or null while nobody is on one.
 *
 * **Where the piece is drawn and what the player may read are two questions**,
 * and this app answered them with one. A player who has never thrown stands on
 * `loka` **68** — the engine parks them there, and the published app does the
 * same from the first screen: `initStore` is `plans: [68, 68, …]` and `Gem`
 * draws wherever `data === plan`. So the mark on 68 is right and stays.
 *
 * The text was not. Opening the app for the first time printed *68. Cosmic
 * Consciousness (Vaikuntha Loka)* and the whole teaching of the square the
 * entire game is played to reach, to somebody who has not begun — under a line
 * that said, correctly, *throw a six to enter the game*. The end of the story
 * handed over on page one.
 *
 * `isWaitingToEnter` is the engine's own separation of the two meanings of
 * `is_finished`: waiting, and having won. A winner is legitimately on 68 and
 * that text is exactly what they have earned, so the same question answers both
 * ends of the game.
 *
 * The seventh sighting of the 68 ambiguity, and the first on this surface.
 * `sixty-eight.test.ts` next door is the table that stops it being the eighth.
 */
export function squareToRead(game: Game): number | null {
  const state = currentPlayer(game.session).state;
  return isWaitingToEnter(state) ? null : state.loka;
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

export interface StartingOver {
  /** The game to show. The one handed in, when the act is refused. */
  game: Game;
  /** Whether it happened. A refused act changes nothing and says nothing. */
  begun: boolean;
  /**
   * Whether the question goes with it.
   *
   * A new game is a new question. This screen carried the last one forward:
   * the board was emptied, the seed replaced so no draft could survive it —
   * and the sentence the finished game was played to answer stood over the new
   * one, with the gate before the first throw already open on it, so a player
   * beginning again was never asked what they were beginning for.
   *
   * The bot reached the same place by a different route and answered it the
   * same way: `/end` lets go of the question with the game. Said here rather
   * than done here, because the question is on the device and in the screen's
   * own state and this file holds neither — but the *decision* is the game's,
   * and a screen that had to decide it would decide it differently.
   */
  askAgain: boolean;
}

/**
 * Begin again, when there is something to begin again from.
 *
 * **The act asks its own question.** The button is drawn from `isOver` and
 * asked nothing itself, which is the shape three defects in the mini app came
 * from and the reason `throwDie` re-asks `mayThrow` five lines from the control
 * that is already disabled. A hidden control cannot be pressed — but that is
 * the drawing's promise, not this function's.
 *
 * **The rules carry forward.** The screen said `newGame(startingSeed())`, which
 * takes the default, so a game begun under any other variant would have come
 * back as `CLASSIC` — a second answer to a question the game already holds. The
 * ruleset is the session's; nothing else here decides it.
 *
 * **And never the same seed.** A draft, the die and the saved board are all
 * told apart by it, so handing back the game just finished would let what was
 * being written about the winning square reappear in the game that replaced it.
 */
export function startOver(game: Game, seed: number): StartingOver {
  if (!isOver(game)) return { game, begun: false, askAgain: false };

  return {
    game: newGame(seed === game.seed ? seed + 1 : seed, game.rules),
    begun: true,
    askAgain: true,
  };
}
