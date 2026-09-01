/**
 * Whether the player owes a reflection before the next throw.
 *
 * The reports are the game. Rolling is the cheap part — the die decides which
 * question you are asked, and the answer is the move that matters. A board that
 * lets you roll forever without writing is a board that has quietly turned into
 * snakes and ladders.
 *
 * So the die is closed until the square you are standing on has been written
 * about. Two things this deliberately does not do:
 *
 *   - It does not gate the throw that puts you on the board. Before the first
 *     six there is no square to write about, and a game that will not let you
 *     start is not a rule, it is a wall.
 *   - It does not ask again for a square already written about in this visit.
 *     Landing back on 6 after a snake is a new visit and asks again; the same
 *     landing does not ask twice.
 *
 * Kept apart from the renderer and the storage so it can be tested at all: this
 * is the one piece of the gate that can be silently wrong, and being wrong in
 * the closed direction means a player who cannot play.
 */

export interface Standing {
  /** The plan the thread is about, or null before anyone has landed. */
  readonly plan: number | null;
  /** How many reflections are already written about that plan, this visit. */
  readonly written: number;
  /**
   * True when the last throw earned another one — a six.
   *
   * A turn is not over until it stops moving. Gating between the throws of a
   * six chain made the screen contradict itself: the sentence said *a six
   * throws again* while the die beneath it said *write first*, so the player
   * read the instruction, pressed the die, and nothing happened. That is
   * exactly what "the moves do not work" looks like from the outside.
   */
  readonly rollsAgain?: boolean;
}

export type Owed =
  | {
      readonly owes: false;
      readonly why: 'not-on-the-board' | 'already-written' | 'still-moving';
    }
  | { readonly owes: true; readonly plan: number };

/** The rule, stated once. */
export const owedFor = (standing: Standing): Owed => {
  if (standing.plan === null) {
    return { owes: false, why: 'not-on-the-board' };
  }
  if (standing.rollsAgain) {
    return { owes: false, why: 'still-moving' };
  }
  if (standing.written > 0) {
    return { owes: false, why: 'already-written' };
  }
  return { owes: true, plan: standing.plan };
};

/** True when the die should be closed. */
export const holdsTheDie = (standing: Standing): boolean =>
  owedFor(standing).owes;
