/**
 * How much of the sheet is showing.
 *
 * Three positions, not a free height. A panel a player can leave at any size is
 * a panel they leave at a useless one, and the three that matter here are
 * *enough to throw*, *enough to read*, and *all of it* — the loop the game
 * actually runs: throw, land, read, write, throw.
 *
 * The arithmetic is here and the DOM is not, because "which detent is this
 * drag closest to" is the part that can be off by one and look merely
 * unpleasant rather than broken.
 */

export type Detent = 'peek' | 'half' | 'full';

/** In the order they grow. */
export const DETENTS: readonly Detent[] = ['peek', 'half', 'full'];

/** Pixels of screen each detent stands in. */
export type Heights = Readonly<Record<Detent, number>>;

/** The detent a height of `pixels` is nearest to. */
export const nearest = (pixels: number, heights: Heights): Detent => {
  let best: Detent = DETENTS[0] as Detent;
  let closest = Number.POSITIVE_INFINITY;
  for (const detent of DETENTS) {
    const gap = Math.abs(heights[detent] - pixels);
    // Strictly closer, so a tie keeps the smaller detent: a drag that lands
    // exactly between two should uncover less, not more. Uncovering the board
    // is always recoverable by dragging again; covering it hides the thing the
    // player was reaching for.
    if (gap < closest) {
      closest = gap;
      best = detent;
    }
  }
  return best;
};

/**
 * Where the handle sends you.
 *
 * One button, and it grows until it cannot, then collapses all the way. A
 * toggle between two states would make the middle detent reachable only by
 * dragging, which no keyboard has.
 */
export const stepped = (from: Detent): Detent => {
  const at = DETENTS.indexOf(from);
  return at < 0 || at === DETENTS.length - 1
    ? (DETENTS[0] as Detent)
    : (DETENTS[at + 1] as Detent);
};

/**
 * A drag, resolved.
 *
 * @param start   sheet height when the drag began
 * @param travel  how far the pointer has moved *down* the screen, in pixels
 * @param heights what each detent is worth right now
 */
export const dragged = (start: number, travel: number, heights: Heights): Detent =>
  nearest(start - travel, heights);
