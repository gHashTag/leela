import { describe, expect, it } from 'vitest';

import { DETENTS, atEnd, bringIntoView, dragged, nearest, stepped, type Heights } from '../src/sheet';

/**
 * The sheet's arithmetic, which is all of it that can be wrong quietly.
 *
 * `bringIntoView` exists because the companion's newest line was arriving below
 * the fold of a panel a hundred and forty pixels tall, and the browser call
 * that was supposed to reveal it did nothing on this layout. What the screen
 * does with the number is still only checkable by looking; that the number is
 * right is checkable here.
 */

const HEIGHTS: Heights = { peek: 120, half: 380, full: 700 };

describe('the detents', () => {
  it('resolves a height to the nearest detent', () => {
    expect(nearest(118, HEIGHTS)).toBe('peek');
    expect(nearest(390, HEIGHTS)).toBe('half');
    expect(nearest(9999, HEIGHTS)).toBe('full');
  });

  it('grows until it cannot, then collapses all the way', () => {
    expect(stepped('peek')).toBe('half');
    expect(stepped('half')).toBe('full');
    expect(stepped('full')).toBe('peek');
    // Every detent is reachable from every other by pressing one button.
    const walk = new Set<string>();
    let at = DETENTS[0]!;
    for (let step = 0; step < DETENTS.length; step += 1) {
      walk.add(at);
      at = stepped(at);
    }
    expect(walk.size).toBe(DETENTS.length);
  });

  it('reads a drag downwards as a smaller sheet', () => {
    expect(dragged(700, 300, HEIGHTS)).toBe('half');
    expect(dragged(380, -300, HEIGHTS)).toBe('full');
  });
});

describe('bringing a line into view', () => {
  const view = { scrollTop: 0, clientHeight: 140, scrollHeight: 1000 };

  it('says nothing to do when the box is already in view', () => {
    expect(bringIntoView(view, { top: 20, height: 40 })).toBeNull();
  });

  it('scrolls just far enough to show a box below the fold', () => {
    // 685..856 against a window ending at 745 — the measured case.
    const to = bringIntoView({ scrollTop: 0, clientHeight: 143, scrollHeight: 1033 }, { top: 685, height: 171 });
    expect(to).not.toBeNull();
    expect(to!).toBeGreaterThan(0);
    expect(to!).toBeLessThanOrEqual(1033 - 143);
  });

  it('shows the top of a box too tall to fit, not its end', () => {
    const to = bringIntoView(view, { top: 400, height: 500 });
    expect(to).toBe(400 - 8);
  });

  it('scrolls back up for a box above the window', () => {
    expect(bringIntoView({ ...view, scrollTop: 500 }, { top: 100, height: 40 })).toBe(92);
  });

  it('never scrolls past either end', () => {
    expect(bringIntoView({ ...view, scrollTop: 10 }, { top: 0, height: 20 })).toBe(0);
    const far = bringIntoView(view, { top: 990, height: 30 });
    expect(far).toBe(1000 - 140);
  });

  /** A scroll that changes nothing still cancels one the player started. */
  it('says nothing to do rather than assigning the position it is already at', () => {
    expect(bringIntoView({ scrollTop: 0, clientHeight: 140, scrollHeight: 100 }, { top: 0, height: 40 })).toBeNull();
    expect(bringIntoView({ ...view, scrollTop: 860 }, { top: 990, height: 30 })).toBeNull();
  });

  /**
   * The property the whole function exists for. Boxes are generated inside the
   * content, because a box that ends past `scrollHeight` cannot exist in a
   * scroller — a first draft of this test asserted one at 980..1040 inside a
   * thousand pixels of content and failed, which said nothing about the code.
   */
  it('puts the box inside the window whenever it says to move', () => {
    for (const top of [0, 50, 300, 700, 860]) {
      for (const height of [20, 60, 124]) {
        if (top + height > view.scrollHeight) continue;
        // Taller boxes are shown from the top by design; they cannot fit.
        if (height + 16 > view.clientHeight) continue;

        const at = bringIntoView(view, { top, height }) ?? view.scrollTop;
        expect(top).toBeGreaterThanOrEqual(at - 0.001);
        expect(top + height).toBeLessThanOrEqual(at + view.clientHeight + 0.001);
      }
    }
  });

  /** Past the end of the content it scrolls as far as there is, and no further. */
  it('clamps to the end rather than chasing a box beyond the content', () => {
    expect(bringIntoView(view, { top: 980, height: 60 })).toBe(1000 - 140);
  });
});

describe('resting at the end', () => {
  const view = { scrollTop: 0, clientHeight: 140, scrollHeight: 1000 };

  it('is true at the end and false anywhere above it', () => {
    expect(atEnd({ ...view, scrollTop: 860 })).toBe(true);
    expect(atEnd({ ...view, scrollTop: 400 })).toBe(false);
    expect(atEnd({ ...view, scrollTop: 0 })).toBe(false);
  });

  /** A scroller at its end reports fractional pixels on a scaled display. */
  it('tolerates the fraction a real scroller rests at', () => {
    expect(atEnd({ ...view, scrollTop: 857.5 })).toBe(true);
    expect(atEnd({ ...view, scrollTop: 855 })).toBe(false);
  });

  it('is true when there is nothing to scroll', () => {
    expect(atEnd({ scrollTop: 0, clientHeight: 140, scrollHeight: 100 })).toBe(true);
    expect(atEnd({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 })).toBe(true);
  });

  /**
   * The pair this is used as: asked before the rebuild, acted on after it. A
   * list resting at its end was following and should keep following; one the
   * player scrolled up to read was not, and must be left alone.
   */
  it('tells a list that was following from one that was being read', () => {
    const atTheEnd = { scrollTop: 860, clientHeight: 140, scrollHeight: 1000 };
    const beingRead = { scrollTop: 300, clientHeight: 140, scrollHeight: 1000 };
    expect(atEnd(atTheEnd)).toBe(true);
    expect(atEnd(beingRead)).toBe(false);
  });
});

/**
 * The property the path list rests on, and the one the first attempt got wrong.
 *
 * The path rows scroll inside `#path-list`, which itself sits inside the panel
 * `#sheet-body`. Aiming a row into view *of the list* is worth nothing when the
 * list's own box is taller than the panel over it: measured at the half detent,
 * 341px of list inside a 143px panel, and the aimed row landed nowhere on
 * screen. Capping the list to the panel is what makes in-view mean visible.
 */
describe('a scroller inside a scroller', () => {
  const onScreen = (inner: number, outer: number, box: { top: number; height: number }, content: number) => {
    const view = { scrollTop: 0, clientHeight: inner, scrollHeight: content };
    const at = bringIntoView(view, box) ?? 0;
    // Where the box sits inside the inner viewport once it has been aimed.
    const withinInner = box.top - at;
    return withinInner >= 0 && withinInner + box.height <= outer;
  };

  it('cannot put a row on screen while the inner box is taller than the panel', () => {
    // The measured case: list 341, panel 143, the newest row at the end.
    expect(onScreen(341, 143, { top: 1150, height: 24 }, 1338)).toBe(false);
  });

  it('puts every row on screen once the inner box is capped to the panel', () => {
    for (const panel of [119, 143, 265, 525]) {
      for (const rows of [3, 12, 40, 120]) {
        const rowHeight = 24;
        const content = rows * rowHeight;
        const inner = Math.min(341, panel);
        const last = { top: content - rowHeight, height: rowHeight };
        expect(onScreen(inner, panel, last, content)).toBe(true);
      }
    }
  });
});
