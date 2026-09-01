/**
 * The margin around the board.
 *
 * The rules illustration carries a decorated edge — feathers and crystals — and
 * every painted Gyan Chaupar cloth has *something* there, because a board is an
 * object with an edge and a field that runs to the cut is a swatch. This board
 * has been a bare slab through six passes, and now that the perspective is
 * corrected the edge is the most visible thing left that says unfinished.
 *
 * What is here rather than in the renderer is the fitting, and it has one
 * property worth testing: **a whole number of motifs.** A border whose last
 * repeat is clipped by the corner is the single clearest tell of a pattern
 * applied rather than drawn, and it is invisible in code — the arithmetic looks
 * right, and the seam only shows in the corner of a render nobody zoomed into.
 */

export interface Run {
  /** Centres along the edge, in the same units as the span. */
  readonly at: number[];
  /** The spacing actually used, which is the span divided by the count. */
  readonly pitch: number;
}

/**
 * How many motifs fit in a span, as a whole number.
 *
 * Never zero: a short edge gets one motif rather than none, because an edge
 * with nothing on it beside three edges with something is worse than a motif
 * that is slightly the wrong size.
 */
export const fitCount = (span: number, wanted: number): number => {
  if (!(span > 0)) throw new RangeError(`a span must be positive, got ${span}`);
  if (!(wanted > 0)) throw new RangeError(`a motif must be positive, got ${wanted}`);
  return Math.max(1, Math.round(span / wanted));
};

/**
 * Where each motif sits, centred in its own share of the span.
 *
 * Half a pitch in from each end, so the run is symmetric and two runs meeting
 * at a corner leave the same gap on both sides of it.
 */
export const runAlong = (span: number, wanted: number): Run => {
  const count = fitCount(span, wanted);
  const pitch = span / count;
  return {
    pitch,
    at: Array.from({ length: count }, (_, index) => (index + 0.5) * pitch),
  };
};

/** The drawing a border needs, so a test can be the canvas. */
export interface Edger {
  fillStyle: string | unknown;
  strokeStyle: string | unknown;
  lineWidth: number;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
}

export interface BorderStyle {
  /** The paper the whole face is painted on. */
  readonly ground: string;
  /** The band, and the motifs on it. */
  readonly ink: string;
  /** How wide the margin is, as a fraction of the shorter side. */
  readonly margin?: number;
  /** How wide one motif is, as a fraction of the shorter side. */
  readonly motif?: number;
}

/**
 * Paints the board's face: ground, a ruled margin, and a run of diamonds.
 *
 * Diamonds because they are the one motif that survives being seen at thirty
 * pixels on a phone and still reads as deliberate. Anything with more detail
 * becomes a dotted line at the distance this board is played at, and a dotted
 * line is what a placeholder looks like.
 */
export function paintBorder(
  edger: Edger,
  width: number,
  height: number,
  style: BorderStyle,
): void {
  const short = Math.min(width, height);
  const margin = short * (style.margin ?? 0.052);
  const motif = short * (style.motif ?? 0.038);

  edger.fillStyle = style.ground;
  edger.fillRect(0, 0, width, height);

  // Two rules: one just inside the edge, one at the field's boundary. The band
  // between them is what the motifs run along.
  edger.strokeStyle = style.ink;
  edger.lineWidth = Math.max(1, short * 0.004);
  edger.strokeRect(margin * 0.32, margin * 0.32, width - margin * 0.64, height - margin * 0.64);
  edger.lineWidth = Math.max(1, short * 0.002);
  edger.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  const half = motif / 2;
  const diamond = (cx: number, cy: number): void => {
    edger.beginPath();
    edger.moveTo(cx, cy - half);
    edger.lineTo(cx + half, cy);
    edger.lineTo(cx, cy + half);
    edger.lineTo(cx - half, cy);
    edger.closePath();
    edger.fill();
  };

  edger.fillStyle = style.ink;

  // The band's centre line, on each of the four edges. Runs are fitted between
  // the corners rather than across the whole side, so the corner diamonds are
  // not counted twice and the two runs meeting there are symmetric.
  const band = margin * 0.66;
  const inner = { left: margin, right: width - margin, top: margin, bottom: height - margin };

  for (const x of runAlong(inner.right - inner.left, motif * 2).at) {
    diamond(inner.left + x, band);
    diamond(inner.left + x, height - band);
  }
  for (const y of runAlong(inner.bottom - inner.top, motif * 2).at) {
    diamond(band, inner.top + y);
    diamond(width - band, inner.top + y);
  }

  // A diamond on each corner, so the four runs meet at something rather than
  // stopping in the air.
  for (const [cx, cy] of [
    [band, band],
    [width - band, band],
    [band, height - band],
    [width - band, height - band],
  ] as ReadonlyArray<readonly [number, number]>) {
    diamond(cx, cy);
  }
}
