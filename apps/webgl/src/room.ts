/**
 * How tall the writing box has to be before the player has written anything.
 *
 * The box the game tells you to write in — *"Write what you meet on this plan.
 * The die will not throw until you do"* — showed its own question cut in half
 * on a phone. Measured 2026-08-29 at 375 CSS pixels: the field is 46 px tall
 * and its placeholder, *"What does this plan bring up?"*, needs 70. So the
 * player read **"What does this plan bring"** and a sliver of the line under
 * it, on the one control the whole game waits for.
 *
 * It grows correctly once you type — 68 px for the same two lines — because
 * `grow()` measures `scrollHeight` and sets it. What it would not do is
 * measure an EMPTY field, and the reason is written into `main.ts` and is a
 * real one:
 *
 *   > This measured `scrollHeight` unconditionally, and it is called once at
 *   > startup — while the sheet is still animating into its detent, so the
 *   > measurement is taken against a box that is not yet the box. It read 598px
 *   > on an empty field, the stylesheet clamped that to `max-height: 30dvh`,
 *   > and the writing box stood 244 pixels tall over the board with nothing in
 *   > it, every launch, until somebody typed.
 *
 * That fix worked and it cost this. Refusing to measure an empty field is
 * refusing to see the placeholder, and 46 px is one row whatever the
 * placeholder needs in the language the player reads — there are twenty-two,
 * and the longest wrap further than English.
 *
 * **I COULD NOT REPRODUCE THE 598, AND THIS DOES NOT ASSUME A CAUSE FOR IT.**
 * The obvious theory — a box measured at zero width — was tested against the
 * live page and refuted: the field is `flex: 1`, so an inline `width: 0` does
 * not narrow it. Designing around a mechanism I had not established would be
 * building on a guess, so this refuses the reading on its SHAPE instead.
 *
 * An empty field contains one sentence. Two lines is ordinary, three is a long
 * sentence in a wide script, and **a number that would take a couple of dozen
 * lines is not a measurement of this box** — it is a measurement of something
 * that was not laid out yet. So a plausible reading is used and an implausible
 * one is dropped, which leaves the stylesheet's own `min-height` standing:
 * exactly the behaviour that shipped before this file existed. The worst case
 * of this change is the state it replaces.
 */

/**
 * The most lines a placeholder may plausibly want.
 *
 * Four, against a placeholder that needs two in English at the narrowest
 * width the game is played at. It is a ceiling on *credibility*, not on
 * layout — the stylesheet's `max-height: 30dvh` is what actually bounds the
 * box — so it wants to sit above every real language and far below the
 * two-dozen-line reading that made this necessary. 598 px is twenty-four
 * lines; four is not a close call in either direction.
 */
export const MOST_ROWS = 4;

export interface Room {
  /** `scrollHeight` with the inline height cleared: what the content wants. */
  measured: number;
  /** The stylesheet's `min-height`, which is what stands if nothing is set. */
  floor: number;
  /** One line, from the computed style — the unit the ceiling is counted in. */
  lineHeight: number;
  /** Top plus bottom border. See {@link boxFor}: under `border-box` it is not
   *  included in `scrollHeight` but IS included in the height being set. */
  borderY: number;
}

/**
 * The height to SET, given the height the content WANTS.
 *
 * `scrollHeight` is content plus padding and excludes the border; the field is
 * `box-sizing: border-box`, so a height set from it makes the border box that
 * tall and the content two pixels shorter than it asked for. The last line of
 * whatever the player is reading or writing loses its descenders.
 *
 * FOUND ON THE LIVE SITE, AFTER THE PLACEHOLDER FIX WAS ALREADY DEPLOYED: the
 * box grew from 46 to 68 and `scrollHeight` was still 70. It is not new — the
 * typed path has had the same shortfall since it was written, 92 against 94 —
 * so this is one arithmetic error in two branches, and it is written once here
 * rather than twice at the call site.
 */
export function boxFor(measured: number, borderY: number): number {
  return measured + (Number.isFinite(borderY) && borderY > 0 ? borderY : 0);
}

/**
 * The height to set on an empty writing box, or null to set none.
 *
 * Null is not a failure and is the common answer: on a wide screen the
 * placeholder fits the floor and there is nothing to add. Returning null
 * rather than the floor matters — writing the floor as an inline height would
 * pin the box at it, and the box has to be free to grow the moment the player
 * types.
 */
export function roomFor({ measured, floor, lineHeight, borderY }: Room): number | null {
  // Nothing measurable. A box that has not been laid out reports 0, and 0 is
  // not "the placeholder fits" — it is "there is nothing to read here yet".
  if (!Number.isFinite(measured) || measured <= 0) return null;

  // Bigger than any sentence: not this box. See the note above — the shape of
  // the number is refused, not a cause it might have had.
  if (Number.isFinite(lineHeight) && lineHeight > 0 && measured > lineHeight * MOST_ROWS) {
    return null;
  }

  // It fits as it is. The stylesheet is right and cannot be measured wrong.
  // Compared against the CONTENT height, not the box height: the floor is a
  // `min-height` and under `border-box` that bounds the same box the border is
  // counted in, so adding the border first would make a fitting placeholder
  // look two pixels too tall and pin the box for no reason.
  if (measured <= floor) return null;

  return boxFor(measured, borderY);
}
