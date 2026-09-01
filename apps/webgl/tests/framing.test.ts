import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  MARGIN,
  bandFor,
  cornersOf,
  elevationFor,
  frameBoard,
  spanOf,
  visibleFor,
} from '../src/framing';

/**
 * Three defects shipped from the framing and **every one was caught by eye** —
 * a pan signed the wrong way, an inset read from the bottom only, and a fit
 * that measured the play field after the board had grown a margin. Three of a
 * kind is a pattern, and the answer to a pattern is an instrument.
 *
 * None of this needs a GPU. A `PerspectiveCamera` and `Vector3.project` are
 * arithmetic; only `WebGLRenderer` wants a context. So these build a real
 * camera, frame a real board, and ask where the corners landed.
 */

/** The slab, at the proportions the app actually uses. */
const BOARD = { width: 10.54, depth: 9.46, ceiling: 1.9 };

const camera = () => new THREE.PerspectiveCamera(24, 1, 0.1, 400);

/** Where the board's corners ended up, in clip space. */
const framed = (viewport: { width: number; height: number }, inset = {}) => {
  const view = camera();
  const frame = frameBoard(view, BOARD, viewport, inset);
  return { frame, span: spanOf(view, cornersOf(BOARD)), view };
};

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'phone landscape', width: 812, height: 375 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 720 },
  { name: 'square', width: 600, height: 600 },
];

const INSETS = [
  { name: 'nothing', inset: {} },
  { name: 'a peek sheet', inset: { bottom: 132 } },
  { name: 'a half sheet', inset: { bottom: 380 } },
  { name: 'a side panel', inset: { right: 420 } },
];

describe('the band', () => {
  it('is the whole canvas when nothing covers it', () => {
    const band = bandFor({ width: 400, height: 800 }, {});
    expect(band.bottom).toBeCloseTo(-1);
    expect(band.right).toBeCloseTo(1);
    expect(band.height).toBeCloseTo(2);
    expect(band.width).toBeCloseTo(2);
  });

  it('shrinks upward for a bottom sheet and inward for a side panel', () => {
    expect(bandFor({ width: 400, height: 800 }, { bottom: 400 }).height).toBeCloseTo(1);
    expect(bandFor({ width: 400, height: 800 }, { right: 200 }).width).toBeCloseTo(1);
  });

  /** On a short window at the full detent there would be no band left. */
  it('never lets a panel claim the whole canvas', () => {
    const band = bandFor({ width: 400, height: 800 }, { bottom: 10_000, right: 10_000 });
    expect(band.height).toBeGreaterThan(0.2);
    expect(band.width).toBeGreaterThan(0.2);
  });
});

describe('framing the board', () => {
  /**
   * The whole point, and the assertion the *blank page* would have failed: the
   * board has to be inside the part of the canvas nobody is standing on. When
   * the pan was signed the wrong way the board sat below the band entirely.
   */
  it('puts the whole board inside the band, in every viewport and under every panel', () => {
    for (const viewport of VIEWPORTS) {
      for (const { name, inset } of INSETS) {
        const { frame, span } = framed(viewport, inset);
        const where = `${viewport.name} with ${name}`;

        expect(span.midY - span.y / 2, `${where}: off the bottom of the band`).toBeGreaterThan(
          frame.band.bottom - 0.001,
        );
        expect(span.midY + span.y / 2, `${where}: off the top`).toBeLessThan(1.001);
        expect(span.midX - span.x / 2, `${where}: off the left`).toBeGreaterThan(-1.001);
        expect(span.midX + span.x / 2, `${where}: under the side panel`).toBeLessThan(
          frame.band.right + 0.001,
        );
      }
    }
  });

  /** Centred in the band, not merely inside it. */
  it('centres the board in the band', () => {
    for (const viewport of VIEWPORTS) {
      for (const { name, inset } of INSETS) {
        const { frame, span } = framed(viewport, inset);
        const where = `${viewport.name} with ${name}`;
        expect(span.midY, `${where}: not centred vertically`).toBeCloseTo(
          frame.band.bottom + frame.band.height / 2,
          2,
        );
        expect(span.midX, `${where}: not centred horizontally`).toBeCloseTo(
          frame.band.right - frame.band.width / 2,
          2,
        );
      }
    }
  });

  /**
   * Filling the band it was given. A board framed to a third of its space is
   * the defect the projection fit replaced trigonometry to solve, and nothing
   * caught it but looking.
   */
  it('fills the band it was given', () => {
    for (const viewport of VIEWPORTS) {
      for (const { name, inset } of INSETS) {
        const { frame, span } = framed(viewport, inset);
        const filled = Math.max(span.x / frame.band.width, span.y / frame.band.height);
        expect(filled, `${viewport.name} with ${name}: only ${filled.toFixed(2)} of the band`)
          .toBeGreaterThan(MARGIN - 0.06);
        expect(filled, `${viewport.name} with ${name}: overflowing`).toBeLessThan(1);
      }
    }
  });

  /**
   * The margin the board grew for its border is part of the board. Framing the
   * play field alone put the new right edge off the side of the screen, taking
   * the last column of numbers with it.
   */
  it('fits whatever extent it is given, margin and all', () => {
    const bare = { width: 9.64, depth: 8.56, ceiling: 1.9 };
    const view = camera();
    frameBoard(view, bare, { width: 375, height: 812 });
    const withMargin = spanOf(view, cornersOf(BOARD));
    // Framed for the bare field, the bordered slab overflows — which is exactly
    // what shipped. The check is that this is what `BOARD` avoids.
    expect(withMargin.x).toBeGreaterThan(2 * MARGIN);

    const { span } = framed({ width: 375, height: 812 });
    expect(span.x).toBeLessThan(2 * MARGIN + 0.001);
  });

  it('stands more nearly overhead the narrower the space is', () => {
    const portrait = elevationFor(visibleFor({ width: 375, height: 812 }, {}));
    const landscape = elevationFor(visibleFor({ width: 1280, height: 700 }, {}));
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('keeps the board in front of the camera', () => {
    for (const viewport of VIEWPORTS) {
      const { frame, view } = framed(viewport);
      expect(frame.distance).toBeGreaterThan(0);
      for (const corner of cornersOf(BOARD)) {
        const inView = corner.clone().project(view);
        expect(Number.isFinite(inView.z)).toBe(true);
        expect(inView.z).toBeLessThan(1);
      }
    }
  });

  /** Same input, same frame — a board that settles differently each load is
      one a player cannot get used to. */
  it('frames the same board the same way twice', () => {
    const once = framed({ width: 375, height: 812 }, { bottom: 380 });
    const twice = framed({ width: 375, height: 812 }, { bottom: 380 });
    expect(once.frame.distance).toBeCloseTo(twice.frame.distance, 6);
    expect(once.span).toEqual(twice.span);
  });
});

describe('the header, which stands on the board from above', () => {
  const VIEWPORT = { width: 400, height: 800 };

  it('takes its pixels off the top of the band', () => {
    // Found by eye on a phone: the top row — 72, 71, 70 — sat under the plan's
    // number and title. The sheet had been accounted for since the first pass
    // and the header never was, so the board was fitted to a band whose top
    // edge was the top of the canvas and then partly covered by something drawn
    // over it.
    const without = bandFor(VIEWPORT, {});
    const withHeader = bandFor(VIEWPORT, { top: 80 });

    expect(withHeader.height).toBeLessThan(without.height);
    // 80 of 800 is a tenth of the canvas, which is a fifth of clip space.
    expect(withHeader.height).toBeCloseTo(without.height - 0.2, 6);
    // And it eats downwards, so the floor of the band does not move.
    expect(withHeader.bottom).toBeCloseTo(without.bottom, 6);
  });

  it('leaves every caller that has no header exactly where it was', () => {
    // The change has to be arithmetically the line it replaced when `top` is
    // absent, or every framing this app has ever done moves a little.
    // Stated as the identity the old line encoded — `height: 1 - bottom`, a
    // band whose ceiling is the top of the canvas — rather than by copying the
    // clamp's constant into the expectation, which is the shape this repository
    // keeps catching: a test that restates the code instead of the claim.
    for (const bottom of [0, 132, 320, 600, 790]) {
      const before = bandFor(VIEWPORT, { bottom });
      expect(before.bottom + before.height, `sheet of ${bottom}`).toBeCloseTo(1, 6);
    }
  });

  it('shares the room with the sheet rather than each taking it all', () => {
    // A header and a sheet that together cover the screen: honoured in full,
    // the band would come out upside down. It stays a band, right way up, with
    // the floor below the ceiling.
    const squeezed = bandFor(VIEWPORT, { top: 700, bottom: 700 });
    expect(squeezed.height).toBeGreaterThan(0);
    expect(squeezed.bottom + squeezed.height).toBeLessThanOrEqual(1 + 1e-9);
    expect(squeezed.bottom).toBeGreaterThanOrEqual(-1 - 1e-9);
  });

  it('is ignored when it is nonsense', () => {
    // A measurement from the DOM can arrive negative mid-transition.
    expect(bandFor(VIEWPORT, { top: -50 }).height).toBeCloseTo(bandFor(VIEWPORT, {}).height, 6);
  });
});
