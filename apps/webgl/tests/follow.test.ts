import { describe, expect, it } from 'vitest';

import { SLACK, shouldFollow } from '../src/follow';

/**
 * Following the newest line, unless somebody is reading.
 *
 * The reasoning arrives token by token. Two wants conflict: the newest line
 * should stay in view, and a player who scrolled up to re-read a step must not
 * be yanked back down half a second later.
 */

const box = (scrollTop: number, scrollHeight: number, clientHeight = 300) => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

describe('whether to keep the newest line in view', () => {
  it('follows when the reader is at the bottom', () => {
    // 900 tall, 300 visible, scrolled the full 600: at the bottom.
    expect(shouldFollow(box(600, 900))).toBe(true);
  });

  it('lets go the moment the reader scrolls up', () => {
    // Scrolling up is what says "I am reading".
    expect(shouldFollow(box(0, 900))).toBe(false);
    expect(shouldFollow(box(300, 900))).toBe(false);
  });

  it('follows again when they scroll back down', () => {
    expect(shouldFollow(box(600, 900))).toBe(true);
  });

  it('forgives a pixel or two', () => {
    // Not an exact test: a fractional layout, a half-drawn line and a
    // rubber-band all leave a little, and an exact one would stop following the
    // moment the box grew a partial line.
    expect(shouldFollow(box(600 - SLACK, 900))).toBe(true);
    expect(shouldFollow(box(600 - SLACK - 1, 900))).toBe(false);
  });

  it('follows when there is nothing to scroll', () => {
    // Everything is visible, so the newest line is in view by definition. The
    // subtraction alone would go negative here and the answer would depend on
    // the slack rather than on the fact.
    expect(shouldFollow(box(0, 300))).toBe(true);
    expect(shouldFollow(box(0, 120))).toBe(true);
  });

  it('takes the slack as an argument, so a caller can be stricter', () => {
    expect(shouldFollow(box(590, 900), 0)).toBe(false);
    expect(shouldFollow(box(600, 900), 0)).toBe(true);
  });
});
