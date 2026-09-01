/**
 * Three successful moves free, then the game asks for a subscription.
 *
 * The decision lives here, in one function, because it is the kind of rule that
 * otherwise ends up written twice — once where the die is disabled and once
 * where the message is chosen — and the two drift the first time the number
 * changes.
 *
 * **A page nobody is hosting cannot charge anybody.** Opened at
 * `localhost:4173` in a browser there is no store, no receipt and no way to
 * pay: a toll there would be a game that stops and cannot be started again.
 * The board is free wherever it cannot ask, and asks only inside the app that
 * can take the answer.
 *
 * What counts is a *move*, not a turn and not a square: a six earns another
 * throw and three sixes send a player backwards, so counting turns would hand
 * one player five throws and another two. It counted throws until it was
 * measured - see `movesTaken` for why a refused throw is no longer charged.
 */
import { pathOf } from './path';
import { FREE_MOVES } from '@leela/content';

/**
 * How many moves a player gets before the question is asked.
 *
 * The name is kept so that nothing quietly changes meaning under a rename, and
 * because the app's own `pricing.ts` mirrors it by this name. What it counts
 * changed - see `movesTaken`.
 */
export const FREE_THROWS = FREE_MOVES;

export interface Standing {
  /** Successful moves already taken by this player. */
  readonly taken: number;
  /** Whether the player holds a subscription, as the host reported it. */
  readonly entitled: boolean;
  /**
   * Whether anything is hosting this page.
   *
   * Not a synonym for "in the app": a page can be embedded by something that
   * cannot sell anything. It is the host that decides whether a purchase is
   * possible at all, and it says so by being there.
   */
  readonly hosted: boolean;
}

export interface Toll {
  /** Whether the die may turn. */
  readonly mayThrow: boolean;
  /** Moves left before the question, or null when it will never be asked. */
  readonly left: number | null;
}

export const tollFor = ({ taken, entitled, hosted }: Standing): Toll => {
  // Nobody to pay, so nothing to pay: a browser, a preview, a screenshot.
  if (!hosted) return { mayThrow: true, left: null };
  if (entitled) return { mayThrow: true, left: null };

  const left = Math.max(0, FREE_THROWS - Math.max(0, taken));
  return { mayThrow: left > 0, left };
};

/**
 * Whether this is the move worth warning about.
 *
 * One throw left is the moment to say so — before the die stops rather than
 * after. Saying it on every throw is nagging; saying it only when the die has
 * already stopped is a surprise.
 */
export const isLastFree = (toll: Toll): boolean => toll.left === 1;

/**
 * How many throws a saved table has taken, across every seat.
 *
 * Read from the record rather than counted as they happen: a count kept in a
 * variable is lost on reload, and reloading is how somebody would get their
 * three throws back for ever.
 *
 * Kept because it is the honest answer to *how many times was the die thrown*,
 * which the history panel asks. It is no longer what is charged for — see
 * `movesTaken`.
 */
export const throwsTaken = (perSeat: ReadonlyArray<readonly number[]>): number =>
  perSeat.reduce((all, seat) => all + seat.length, 0);

/**
 * How many throws actually moved somebody.
 *
 * **This is what the free allowance counts, and the difference is not small.**
 *
 * Entry costs a six. A throw that is not a six leaves the player exactly where
 * they were — off the board, having seen nothing — and it used to spend one of
 * their three. The chance of never rolling a six in three throws is
 * `(5/6)^3 = 57.9%`, so more than half of everybody who installed this game
 * would have met the subscription screen without once standing on a plane,
 * without one answer from the guide, asked to pay for something they had not
 * been shown.
 *
 * The same injustice sits at the other end of the board: past plane 68 a throw
 * that would overshoot 72 is refused, and that refusal was charged for too.
 *
 * So the rule is now the one that can be said in a sentence a player would
 * accept: **you are given three moves, not three attempts.** A die that refuses
 * you is not a turn you had.
 *
 * The engine already knows which is which - `pathOf` marks every step `moved`,
 * false for a throw the rules turned down - so this asks it rather than
 * re-deriving the rules here, where the two would drift.
 */
export const movesTaken = (perSeat: ReadonlyArray<readonly number[]>): number =>
  perSeat.reduce(
    (all, seat) => all + pathOf(seat).filter((step) => step.moved).length,
    0,
  );
