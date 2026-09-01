import { describe, expect, it } from 'vitest';

import { OPENED, coveredBy, isOpen } from '../src/keyboard';

/**
 * The keyboard, measured rather than guessed.
 *
 * Found on a real phone: the player taps the writing box, the keyboard comes
 * up over it, and they type blind. A page inside a `WebView` does not shrink —
 * the layout viewport stays the full height of the screen and the keyboard is
 * drawn on top of it.
 */

describe('how much the keyboard is standing on', () => {
  it('is the gap between the window and what is still visible', () => {
    // 812-point screen, 336 points of keyboard.
    expect(coveredBy({ height: 476, offsetTop: 0 }, 812)).toBe(336);
  });

  it('counts the scroll as well as the shrink', () => {
    // iOS also *scrolls* the visual viewport when a focused field would sit
    // under the keyboard. Measuring height alone reports the keyboard as
    // smaller than it is by however far the page was pushed up - which is
    // exactly the amount by which the box stays covered.
    expect(coveredBy({ height: 476, offsetTop: 60 }, 812)).toBe(276 + 0);
    expect(coveredBy({ height: 476, offsetTop: 60 }, 812)).toBeLessThan(
      coveredBy({ height: 476, offsetTop: 0 }, 812),
    );
  });

  it('is nothing when no keyboard is up', () => {
    expect(coveredBy({ height: 812, offsetTop: 0 }, 812)).toBe(0);
  });

  it('is never negative', () => {
    // The visual viewport can be taller than the layout one mid-pinch. A
    // negative inset would push the sheet off the bottom of the screen.
    expect(coveredBy({ height: 900, offsetTop: 0 }, 812)).toBe(0);
    expect(coveredBy({ height: 812, offsetTop: -40 }, 812)).toBe(0);
  });

  it('is nothing on a browser that cannot be asked', () => {
    // `visualViewport` is absent on older engines. A page that throws here is
    // a board that does not draw.
    expect(coveredBy(null, 812)).toBe(0);
  });

  it('is nothing rather than NaN when a measurement is not a number', () => {
    expect(coveredBy({ height: Number.NaN, offsetTop: 0 }, 812)).toBe(0);
    expect(coveredBy({ height: 476, offsetTop: Number.NaN }, 812)).toBe(0);
  });

  it('lands on a whole pixel', () => {
    // A fractional inset puts the sheet's frosted edge on a half pixel and it
    // shimmers while the keyboard animates.
    expect(Number.isInteger(coveredBy({ height: 476.4, offsetTop: 0.2 }, 812))).toBe(true);
  });
});

describe('whether that counts as the keyboard', () => {
  it('ignores the few pixels a hiding URL bar moves', () => {
    // `> 0` would treat an ordinary scroll as a keyboard and move the sheet
    // under the reader's thumb.
    expect(isOpen(0)).toBe(false);
    expect(isOpen(40)).toBe(false);
    expect(isOpen(OPENED - 1)).toBe(false);
  });

  it('counts a real keyboard', () => {
    expect(isOpen(OPENED)).toBe(true);
    expect(isOpen(336)).toBe(true);
  });
});
