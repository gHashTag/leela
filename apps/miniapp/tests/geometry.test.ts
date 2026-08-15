import { describe, expect, it } from 'vitest';
import { blank } from '../../../scripts/lib/source.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_COLUMNS, BOARD_ROWS_COUNT } from '@leela/engine';

/**
 * This package's root, taken from this file's own location rather than from the
 * working directory.
 *
 * Seven suites in this directory used to read their fixtures through
 * `process.cwd()`. That works while Vitest is started inside `apps/miniapp` and
 * throws ENOENT the moment the same file is collected from anywhere else — a
 * repository-root run, a coverage pass over all ten workspaces — and the
 * measured symptom was `ENOENT /Users/playra/leela/src/state.ts`. The long
 * version, with the whole measurement, is at the top of
 * `partly-written.test.ts`, which is also where the guard against it lives.
 */
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
const APP: Record<string, number> = {
  /** `imageTopMargin`: `min(ms(27, 0.5), s(27))`. */
  topMargin: 27,
  /** `curImageHeight`: `min(maxImageHeight, imageHeight) + imageTopMargin`. */
  artHeight: Math.min(248 + 32, 248 + 32) + 27,
  /**
   * The image's own proportions — read from the shipped file below rather than
   * written down here. The first attempt wrote 714 x 639 from looking at a
   * rendering of it; the file says 630, and the 1.4% stretched the whole board.
   */
  artAspect: 0,
  /** `curImageWidth`: `s(279) + s(18)`, and nine boxes of `31 + 1 + 1`. */
  gridWidth: 279 + 18,
  /** Eight boxes of `s(31)` with `marginVertical: s(2)`. */
  gridHeight: 8 * (31 + 2 + 2),
  /** `bgImage.top`: `mvs(26, 1.6) - imageTopMargin`. */
  artTop: 26 - 27,
};

/**
 * The painting's size, from the painting.
 *
 * A WebP with alpha carries its canvas size in the `VP8X` chunk: two 24-bit
 * little-endian values, each one less than the dimension. Fifteen lines to
 * read, against a number that was wrong for two passes because it was copied
 * off a screenshot.
 */
function webpSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(PACKAGE, file));
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('VP8X');
  const at = (offset: number) =>
    (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
  return { width: at(24) + 1, height: at(27) + 1 };
}

const ART = webpSize('src/board-light.webp');
APP.artAspect = ART.width / ART.height;

const artWidth = APP.artHeight * APP.artAspect;
const gridLeft = (artWidth - APP.gridWidth) / 2;
const gridTop = APP.topMargin - APP.artTop;

const EXPECTED = {
  /** Percentages of the painting, which is what the board element is. */
  top: (gridTop / APP.artHeight) * 100,
  bottom: ((APP.artHeight - gridTop - APP.gridHeight) / APP.artHeight) * 100,
  inline: (gridLeft / artWidth) * 100,
};

// As a stylesheet. `declaration` reads the first match on a line, and a note
// above a live declaration -- `/* was: aspect-ratio: 3 / 4; */` -- is a line
// that matches: measured, it handed back the value somebody had replaced.
const style = blank(readFileSync(resolve(PACKAGE, 'src/style.css'), 'utf8'), 'css');

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
    expect(declaration('.board', 'aspect-ratio').replace(/\s/g, '')).toBe(
      `${ART.width}/${ART.height}`,
    );
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
    // Measured from the art rather than asserted about the CSS: cropping
    // exactly the cell these numbers give for 68 — 68x72 at (323, 57) —
    // contains the Flower of Life, centred, and nothing else.
    // Recorded here as the arithmetic that produced that crop, so a change to
    // the numbers can be checked against the same picture.
    const toArtPixels = ART.width / artWidth;
    const cell = { width: APP.gridWidth / 9, height: APP.gridHeight / 8 };
    const x = (gridLeft + 4 * cell.width) * toArtPixels;
    const y = (gridTop + 0 * cell.height) * toArtPixels;

    expect(Math.round(x)).toBe(323);
    expect(Math.round(y)).toBe(57);
    expect(Math.round(cell.width * toArtPixels)).toBe(68);
    expect(Math.round(cell.height * toArtPixels)).toBe(72);
  });
});
