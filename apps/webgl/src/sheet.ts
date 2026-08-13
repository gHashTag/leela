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

/** A scrolling box, as much of it as this needs to know. */
export interface Scroller {
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
}

/** Something inside it, in the scroller's own content coordinates. */
export interface Box {
  readonly top: number;
  readonly height: number;
}

/**
 * Where to scroll so a box is in view, or null when it already is.
 *
 * The companion speaks on every landing, and what it says arrives at the bottom
 * of a panel a hundred and forty pixels tall. Measured on a fresh load, one
 * throw put the newest line at 685–856 against a visible box ending at 745: a
 * hundred and eleven pixels of it below the fold, with the scroller still at
 * zero. The proactive half of this game was there and unread.
 *
 * `scrollIntoView` was already being called and is not what arrives — measured
 * both ways on the live page, `behavior: 'smooth'` leaves the scroller at zero
 * and `'auto'` moves it at once. Rather than swap one browser behaviour for
 * another, the position is arithmetic here, where a test can hold it.
 *
 * Null rather than a no-op number: a scroll assignment that changes nothing
 * still cancels a scroll the *player* started, and being yanked back while
 * reading is worse than reaching for the scrollbar.
 */
export const bringIntoView = (view: Scroller, box: Box, margin = 8): number | null => {
  const furthest = Math.max(0, view.scrollHeight - view.clientHeight);
  const clamp = (to: number): number | null => {
    const held = Math.max(0, Math.min(furthest, to));
    return held === view.scrollTop ? null : held;
  };

  // Taller than the window it has to fit in: show where it starts. Scrolling to
  // the end of a long answer shows the player its last line first.
  if (box.height + margin * 2 > view.clientHeight) return clamp(box.top - margin);

  const bottom = box.top + box.height;
  if (bottom + margin > view.scrollTop + view.clientHeight) {
    return clamp(bottom + margin - view.clientHeight);
  }
  if (box.top - margin < view.scrollTop) return clamp(box.top - margin);
  return null;
};
