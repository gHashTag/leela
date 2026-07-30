import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOARD_COLUMNS, BOARD_ROWS_COUNT } from '@leela/engine';

/**
 * Where the grid sits on the painting.
 *
 * The first attempt stretched the grid across the whole image, and every snake
 * and every arrow landed about a square from where it belonged. It was not
 * obviously wrong to look at — the arrows cross, and a square is a small
 * distance on a phone — which is why it shipped.
 *
 * The numbers are not an adjustment until it looked right. They come from
 * `leela/src/components/GameBoard/index.tsx`, which composes the same two
 * things, and this recomputes them from that layout and checks the stylesheet
 * against the answer. A future nudge to make it "look better" fails here.
 */

/** `GameBoard`'s own layout, at the design scale where every `s(n)` is `n`. */
const APP = {
  /** `imageTopMargin`: `min(ms(27, 0.5), s(27))`. */
  topMargin: 27,
  /** `curImageHeight`: `min(maxImageHeight, imageHeight) + imageTopMargin`. */
  artHeight: Math.min(248 + 32, 248 + 32) + 27,
  /** The image's own proportions, `Image.resolveAssetSource`. */
  artAspect: 714 / 639,
  /** `curImageWidth`: `s(279) + s(18)`, and nine boxes of `31 + 1 + 1`. */
  gridWidth: 279 + 18,
  /** Eight boxes of `s(31)` with `marginVertical: s(2)`. */
  gridHeight: 8 * (31 + 2 + 2),
  /** `bgImage.top`: `mvs(26, 1.6) - imageTopMargin`. */
  artTop: 26 - 27,
};

const artWidth = APP.artHeight * APP.artAspect;
const gridLeft = (artWidth - APP.gridWidth) / 2;
const gridTop = APP.topMargin - APP.artTop;

const EXPECTED = {
  /** Percentages of the painting, which is what the board element is. */
  top: (gridTop / APP.artHeight) * 100,
  bottom: ((APP.artHeight - gridTop - APP.gridHeight) / APP.artHeight) * 100,
  inline: (gridLeft / artWidth) * 100,
};

const style = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

/**
 * A declaration's value, from the first rule that carries it.
 *
 * Matched at the start of a line rather than after a semicolon: these rules
 * are commented, and a declaration following a comment has no semicolon before
 * it. The first version of this helper read every value except the two that
 * happened to be explained.
 */
function declaration(selector: string, property: string): string {
  const rule = style.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  return rule.match(new RegExp(`^\\s*${property}\\s*:\\s*([^;]+)`, 'm'))?.[1]?.trim() ?? '';
}

const percent = (value: string) => Number.parseFloat(value.replace('%', ''));

describe('the grid over the painting', () => {
  it('is the painting that has to fit the screen, not the grid', () => {
    // The art is the larger of the two and the grid sits inside it. Sizing the
    // board to the grid pushed the painting off both edges of the phone.
    expect(declaration('.board', 'aspect-ratio').replace(/\s/g, '')).toBe('714/639');
  });

  it('starts where GameBoard starts it', () => {
    expect(percent(declaration('.squares', 'top'))).toBeCloseTo(EXPECTED.top, 1);
    expect(percent(declaration('.squares', 'inset-inline'))).toBeCloseTo(EXPECTED.inline, 1);
  });

  it('ends where GameBoard ends it', () => {
    expect(percent(declaration('.squares', 'bottom'))).toBeCloseTo(EXPECTED.bottom, 1);
  });

  it('is not the whole painting, which is what was wrong before', () => {
    // The failing version had `inset: 0`. Stated as its own assertion because
    // "close to 6.7" passing tells you nothing about how far from zero that is.
    expect(EXPECTED.inline).toBeGreaterThan(5);
    expect(EXPECTED.top).toBeGreaterThan(5);
    expect(percent(declaration('.squares', 'inset-inline'))).toBeGreaterThan(5);
  });

  it('has the board the engine has', () => {
    const rule = style.match(/\.squares\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain(`repeat(${BOARD_COLUMNS}, 1fr)`);
    expect(rule).toContain(`repeat(${BOARD_ROWS_COUNT}, 1fr)`);
  });

  it('puts the Flower of Life on the win square', () => {
    // Measured from the art rather than asserted about the CSS: in
    // `light.png`, cropping exactly the cell these numbers give for 68 —
    // x 323..391, y 58..131 of 714x639 — contains the flower and nothing else.
    // Recorded here as the arithmetic that produced that crop, so a change to
    // the numbers can be checked against the same picture.
    const toArtPixels = 714 / artWidth;
    const cell = { width: APP.gridWidth / 9, height: APP.gridHeight / 8 };
    const x = (gridLeft + 4 * cell.width) * toArtPixels;
    const y = (gridTop + 0 * cell.height) * toArtPixels;

    expect(Math.round(x)).toBe(323);
    expect(Math.round(y)).toBe(58);
    expect(Math.round(cell.width * toArtPixels)).toBe(69);
    expect(Math.round(cell.height * toArtPixels)).toBe(73);
  });
});
