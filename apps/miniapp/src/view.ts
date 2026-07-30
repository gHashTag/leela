/**
 * What the screen should show, decided without a screen.
 *
 * `draw()` in `main.ts` did this inline, and the one thing it got wrong could
 * only have been seen by playing to the end: it asked `state.is_finished` to
 * mean "waiting to enter". A player who has *won* is also finished, so at the
 * moment of reaching Cosmic Consciousness the header reset to "—", the progress
 * bar dropped to zero and the token vanished from square 68 — while the line
 * underneath said they had arrived.
 *
 * `hasWon` is the engine's own answer to that ambiguity and exists because 68
 * means two different things depending on how you got there. This is the fourth
 * place that has bitten.
 */

import {
  WIN_LOKA,
  currentPlayer,
  hasWon,
  isWaitingToEnter,
  type GameState,
  type Session,
} from '@leela/engine';
import { messageFor, type Language, type MessageKey } from '@leela/content';

export interface Headline {
  /** What goes where the plan number is. `—` while off the board. */
  number: string;
  title: string;
  /** 0..WIN_LOKA, for the progress bar. */
  progress: number;
  /** Whether "read this plan" refers to anything. */
  canRead: boolean;
  /** The square to mark as the player's, or null while they are off it. */
  here: number | null;
  /** The square they came from, or null when there is nothing to trace. */
  from: number | null;
  /** True while waiting for a six, so the caller can style it as a pause. */
  waiting: boolean;
}

/** Look up a plan's title. Injected so this stays free of the content loader. */
export type TitleOf = (plan: number) => string;

function traceFrom(previous: number, current: number): number | null {
  if (previous < 1 || previous === current || previous === WIN_LOKA) return null;
  return previous;
}

export function headline(state: GameState, language: Language, titleOf: TitleOf): Headline {
  // Out of play and not a winner: nobody has thrown a six yet.
  if (isWaitingToEnter(state)) {
    return {
      number: '—',
      title: messageFor(language, 'app.waiting'),
      progress: 0,
      canRead: false,
      // On 68, which is where a waiting player sits — this file said so in a
      // comment four lines down and the board showed nothing. The published
      // app starts every player there: `plans: [68, 68, …]` in `initStore`,
      // and `Gem` draws wherever `data === plan`, so the stone is on the board
      // from the first screen. A player looking for their piece before the
      // first six found no piece.
      here: WIN_LOKA,
      from: null,
      waiting: true,
    };
  }

  return {
    number: String(state.loka),
    title: titleOf(state.loka),
    // A win is the bar full, not the bar reset.
    progress: Math.min(state.loka, WIN_LOKA),
    canRead: true,
    here: state.loka,
    // Never a trail from the win square. Entering the game is recorded as a
    // move from 68 — that is where a waiting player sits — and drawing it says
    // the player has just come down from Cosmic Consciousness. Nobody moves
    // *from* 68 in play, so a trail starting there is always the wrong story.
    from: traceFrom(state.previous_loka, state.loka),
    waiting: false,
  };
}

/**
 * The line under the board when nothing has just happened.
 *
 * There was no such thing. `app.opening` — "a six puts you on the board" — was
 * written into the page once, at build time, and only ever replaced by a move
 * or by the report gate. So every player who closed the app and came back was
 * greeted with the instruction for somebody who has never entered: standing on
 * 30, six squares of history behind them, told how to begin.
 *
 * Worse at the other end. A player who reached Cosmic Consciousness — the whole
 * point of the game — reopened it to *"a six puts you on the board"*, and the
 * die was still live. The win was announced as an event and then forgotten,
 * because the app remembered where the player was and not that they had
 * arrived.
 *
 * So the rule: the line describes the state the player is in. Ordered by what
 * the player has to do next, which is what a line under a board is for — the
 * gate first, because it is the only one that blocks the die.
 */
export type Standing = { key: MessageKey; params?: Record<string, string | number> };

export function standing(state: GameState, owed: boolean, titleOf: TitleOf): Standing {
  if (owed) return { key: 'app.reportNeeded' };
  if (hasWon(state)) return { key: 'app.finished' };
  if (isWaitingToEnter(state)) return { key: 'app.opening' };

  return { key: 'app.standing', params: { plan: state.loka, title: titleOf(state.loka) } };
}

/**
 * Whether there is still a throw to make.
 *
 * The engine's own answer rather than one invented here: `advance` refuses a
 * session in which every seat has finished, and it refuses by throwing. So the
 * live die on a completed game was not merely useless — the click it invited
 * raised a `SessionError` out of the roll handler, which is why nothing at all
 * happened and the sentence underneath stayed as it was.
 *
 * A table where somebody else is still playing is not over, and their die stays
 * live: `nextSeat` skips whoever has finished.
 */
export function canRoll(session: Session): boolean {
  // The seat holding the turn, not the table. `isSessionOver` is true only once
  // *everybody* has finished, so at a shared table it would leave the die open
  // to a player who had already reached Cosmic Consciousness.
  //
  // No reachable behaviour changes: `nextSeat` skips a finished player, so the
  // turn does not land on one, and in a game of one the two conditions are the
  // same question. `CLASSIC.mayReenterAfterWinning` remains what it was and
  // remains unreachable in a seated game — see the eighty-second pass, which
  // found it and deliberately left it alone.
  return !hasWon(currentPlayer(session).state);
}

/**
 * Which of the three things the line under the board is saying, and what
 * becomes of the announcement.
 *
 * There are three: a throw that just happened, something the app was told to
 * say, and where the player stands. For most of this app's life there were two,
 * and the second survived by accident — nothing overwrote it. Then the standing
 * line arrived and the accident ended: four confirmations were written straight
 * to the element just before a redraw, and the redraw ate all four at once.
 * Seats set, game restarted, intention held, path imported — every one of them
 * silently.
 *
 * That is a *class* of defect rather than four bugs, so the rule is stated here
 * instead of in the order of two statements at four call sites: an announcement
 * outlives any number of redraws and nothing else, and a throw ends it, because
 * a throw is the next thing happening.
 */
export type Saying = 'move' | 'announcement' | 'standing';

export interface Line {
  says: Saying;
  /** The announcement to keep, or null once it is over. */
  announcement: string | null;
}

export function lineFor(announcement: string | null, moved: boolean): Line {
  if (moved) return { says: 'move', announcement: null };
  if (announcement !== null) return { says: 'announcement', announcement };

  return { says: 'standing', announcement: null };
}

/**
 * Whether a throw may happen, and why not when it may not.
 *
 * The die was disabled by `draw` and the throw was taken by `roll`, and only
 * the first of those two asked any questions. That is the shape the bot was
 * caught in twice: a guard that lives in the surface is a guard that any other
 * path walks straight past.
 *
 * In the mini app the other path is a *double tap*. Nothing exotic — a slip on
 * a phone, two clicks before the dialog can close — and the second one used to
 * file a second account of the same square. `revisited` then counted the square
 * as one the player had returned to, in the one record the game exists to
 * produce.
 */
export type ThrowRefusal = 'yes' | 'rolling' | 'no-intention' | 'owes-report' | 'game-over';

export function mayThrow(
  session: Session,
  intention: string,
  rolling: boolean,
  owed: boolean,
): ThrowRefusal {
  // In the order the player meets them: a throw already under way, then the
  // question the game is played to answer, then the account it asks for, then
  // the end of the game itself.
  if (rolling) return 'rolling';
  if (intention === '') return 'no-intention';
  if (owed) return 'owes-report';
  if (!canRoll(session)) return 'game-over';

  return 'yes';
}

/**
 * What is true of the player who has just written, once the gate has opened.
 *
 * The mini app's version of the bot's `afterReport`, and needed for the same
 * reason: a report is filed by whoever owes one, who is not always the seat
 * holding the turn. "You may throw" is true of one of them at most.
 */
export type AfterWriting = 'finished' | 'not-your-turn' | 'may-throw';

export function afterWriting(session: Session, writerId: string): AfterWriting {
  const writer = session.players.find((player) => player.id === writerId);
  if (writer && hasWon(writer.state)) return 'finished';

  return currentPlayer(session).id === writerId ? 'may-throw' : 'not-your-turn';
}
