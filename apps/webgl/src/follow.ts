/**
 * Keeping a growing box scrolled to its newest line — unless somebody is
 * reading it.
 *
 * The companion's reasoning arrives token by token and runs many times the
 * length of the answer. Two things are wanted at once and they conflict: the
 * newest line should stay in view, and a player who scrolls up to re-read a
 * step must not be yanked back down half a second later.
 *
 * The rule every chat log settles on: follow only while the reader is *already*
 * at the bottom. Scrolling up is what says "I am reading"; scrolling back down
 * is what says "carry on".
 *
 * This replaced `flex-direction: column-reverse`, which pins the newest line
 * without a script and was the wrong tool twice over: it reverses the order its
 * children are painted in, so the reasoning read bottom to top, and it takes
 * the choice away from the reader entirely.
 */

/** What this needs of an element. Structural, so a test can be one. */
export interface Scroller {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/**
 * How far from the bottom still counts as "at the bottom".
 *
 * Not zero: a fractional layout, a half-drawn line and a rubber-band all leave
 * a pixel or two, and an exact test would stop following the moment the box
 * grew a partial line.
 */
export const SLACK = 24;

/** Whether the newest line should be kept in view. */
export const shouldFollow = (view: Scroller, slack: number = SLACK): boolean => {
  const room = view.scrollHeight - view.clientHeight;
  // Nothing to scroll: everything is visible, so following is trivially true.
  if (room <= 0) return true;

  return room - view.scrollTop <= slack;
};
