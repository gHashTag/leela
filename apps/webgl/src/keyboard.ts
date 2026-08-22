/**
 * How much of the window the on-screen keyboard is standing on.
 *
 * A page in a `WebView` does not shrink when the keyboard comes up. The layout
 * viewport stays the full height of the screen, the keyboard is drawn over the
 * bottom of it, and anything anchored to `bottom: 0` — which is where a writing
 * box belongs — ends up underneath it. On a phone that is the whole composer:
 * the player taps the field, the keyboard covers the field, and they type
 * blind.
 *
 * The **visual viewport** is what actually changed, and it is the only thing
 * that reports the keyboard: `window.innerHeight` is the layout viewport and
 * does not move. The gap between the two is the inset.
 *
 * `offsetTop` belongs in the sum because the visual viewport can also be
 * *scrolled* within the layout viewport — iOS does exactly that when a focused
 * field would otherwise sit under the keyboard, and measuring height alone
 * reports the keyboard as smaller than it is by however far the page was
 * pushed up.
 */

/** What this needs of `window.visualViewport`. Structural, so a test can be one. */
export interface Viewport {
  readonly height: number;
  readonly offsetTop: number;
}

/**
 * Pixels of the window covered from the bottom, or 0.
 *
 * Never negative: the visual viewport can be *taller* than the layout one
 * mid-pinch, and a negative inset would push the sheet off the bottom of the
 * screen.
 *
 * Rounded, because a fractional value lands the sheet on a half pixel and the
 * frosted edge shimmers as the keyboard animates.
 */
export const coveredBy = (viewport: Viewport | null, windowHeight: number): number => {
  if (!viewport) return 0;

  // `offsetTop` clamped before it is used, not after. A negative one means the
  // visual viewport is scrolled *above* the layout viewport - which should not
  // happen and does, briefly, during a rubber-band - and subtracting it would
  // *add* to the inset and lift the sheet for no reason.
  const pushed = Math.max(0, viewport.offsetTop);
  const covered = windowHeight - viewport.height - pushed;
  return Number.isFinite(covered) ? Math.max(0, Math.round(covered)) : 0;
};

/**
 * Whether the keyboard is up, for the couple of decisions that differ.
 *
 * A threshold rather than `> 0`: the visual viewport also shifts by a few
 * pixels when a URL bar hides, and treating that as a keyboard would move the
 * sheet on an ordinary scroll.
 */
export const OPENED = 120;

export const isOpen = (covered: number): boolean => covered >= OPENED;
