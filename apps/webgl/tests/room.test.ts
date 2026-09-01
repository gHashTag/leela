import { describe as group, expect, it } from 'vitest';

import { MOST_ROWS, boxFor, roomFor } from '../src/room';

/**
 * How tall the writing box has to be before anything is written in it.
 *
 * Two readings have to be told apart and they are both `scrollHeight` on an
 * empty field: **70 px**, which is the placeholder wrapping to two lines on a
 * phone and must be honoured, and **598 px**, which is what the box reported
 * once at startup before it had been laid out and must not be. The whole of
 * `roomFor` is that distinction, and these are the two numbers it was written
 * against — both measured, neither invented.
 */

/** The live figures, taken from t27.ai/leela/ at 375 CSS pixels on 2026-08-29. */
const ON_A_PHONE = { floor: 44, lineHeight: 24, borderY: 2 };

group('the room an empty writing box needs', () => {
  it('gives the placeholder its second line, which is the defect this fixes', () => {
    // MEASURED: clientHeight 46, scrollHeight 70, placeholder "What does this
    // plan bring up?". The player saw "What does this plan bring" and a sliver.
    expect(roomFor({ measured: 70, ...ON_A_PHONE })).toBe(72);
  });

  it('adds nothing when the placeholder already fits, so the box can still grow', () => {
    /*
     * The common answer, and null rather than the floor ON PURPOSE: writing 44
     * as an inline height would pin the box there, and it has to be free to
     * grow the moment the player types. A test asserting `44` here would pass
     * while making the box unable to grow at all.
     */
    expect(roomFor({ measured: 44, ...ON_A_PHONE })).toBeNull();
    expect(roomFor({ measured: 30, ...ON_A_PHONE })).toBeNull();
  });

  it('REFUSES the reading that made the box 244 pixels tall over the board', () => {
    /*
     * 598 px is what an empty field reported at startup, before the sheet had
     * finished animating into its detent — twenty-four lines for a field
     * holding nothing. The stylesheet clamped it to 30dvh and the writing box
     * stood a quarter of the screen tall, on every launch, until somebody
     * typed.
     *
     * Refused on its SHAPE. The cause was never established — the obvious
     * theory, a box measured at zero width, was tested against the live page
     * and refuted — and a rule that needs no cause is the one worth having.
     */
    expect(roomFor({ measured: 598, ...ON_A_PHONE })).toBeNull();
  });

  it('draws the line between a long sentence and a number that is not a box', () => {
    // Exactly at the ceiling is still a sentence; one pixel past it is not.
    const ceiling = ON_A_PHONE.lineHeight * MOST_ROWS;

    expect(roomFor({ measured: ceiling, ...ON_A_PHONE })).toBe(ceiling + ON_A_PHONE.borderY);
    expect(roomFor({ measured: ceiling + 1, ...ON_A_PHONE })).toBeNull();
  });

  it('leaves room for languages that wrap further than English', () => {
    // Three lines is a long sentence in a wide script, and the game is played
    // in twenty-two languages. It must not be mistaken for the bad reading.
    expect(roomFor({ measured: 3 * ON_A_PHONE.lineHeight, ...ON_A_PHONE })).toBe(74);
  });

  it('reads a box that has not been laid out as nothing, not as a fit', () => {
    /*
     * A node that is not in a document reports 0, and 0 must not be taken for
     * "the placeholder fits" — that answer is right by accident and wrong the
     * moment the floor changes. This project has been caught by an absent
     * value read as a measured zero before.
     */
    expect(roomFor({ measured: 0, ...ON_A_PHONE })).toBeNull();
    expect(roomFor({ measured: Number.NaN, ...ON_A_PHONE })).toBeNull();
    expect(roomFor({ measured: -10, ...ON_A_PHONE })).toBeNull();
  });

  it('still answers when the line height cannot be read', () => {
    /*
     * `getComputedStyle(...).lineHeight` is the string `normal` on an element
     * whose line height is not set in pixels, and `parseFloat` gives NaN for
     * it. The ceiling is then unenforceable, and the honest response is to
     * keep the part of the rule that still works rather than refuse
     * everything: the placeholder gets its second line, and the implausible
     * reading is caught by the stylesheet's own `max-height` as it was before.
     */
    expect(roomFor({ measured: 70, floor: 44, lineHeight: Number.NaN, borderY: 2 })).toBe(72);
    expect(roomFor({ measured: 40, floor: 44, lineHeight: Number.NaN, borderY: 2 })).toBeNull();
  });
});

group('the height to set, given the height the content wants', () => {
  it('adds the border, because the box being sized counts it and scrollHeight does not', () => {
    /*
     * MEASURED ON THE LIVE SITE, after the placeholder fix had already shipped:
     * the box grew from 46 to 68 and `scrollHeight` was still 70. `box-sizing`
     * is `border-box`, so a height set from `scrollHeight` — content plus
     * padding, no border — leaves the content two pixels short and the last
     * line loses its descenders.
     *
     * The typed path had the same shortfall from the day it was written, 92
     * against 94. One arithmetic error in two branches.
     */
    expect(boxFor(70, 2)).toBe(72);
    expect(boxFor(94, 2)).toBe(96);
  });

  it('adds nothing when there is no border to add', () => {
    expect(boxFor(70, 0)).toBe(70);
    expect(boxFor(70, Number.NaN)).toBe(70);
  });

  it('is what roomFor returns, so the two cannot drift apart', () => {
    // The empty path and the typed path do the same arithmetic or they do not
    // agree about where the bottom of the box is.
    expect(roomFor({ measured: 70, ...ON_A_PHONE })).toBe(boxFor(70, ON_A_PHONE.borderY));
  });
});
