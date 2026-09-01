/**
 * The numbers on the squares.
 *
 * The board shipped without them. Seventy-two coloured tiles and thirty arcs
 * over the top, and no way to answer *which square is that* — which is the one
 * question a Leela board exists to answer, since every plan is a named text the
 * player is meant to go and read. The mini app's comment on its own painting
 * says the same thing from the other side: it keeps the plain numbered grid as
 * the default and treats the artwork as the upgrade, because *a board nobody
 * can read is worse than a plain one*.
 *
 * One canvas holds all seventy-two, and one mesh draws them: seventy-two quads
 * sharing a texture and a material, addressed by UV. The alternative — a
 * texture and a material per square — is seventy-two of each and shows up on a
 * phone.
 *
 * The arithmetic is here, without three.js, because it is the part that can be
 * wrong in a way nobody sees: a tile off by one row paints the whole board with
 * its neighbour's number, and the board still looks like a board.
 */

/** A rectangle in texture space, as three.js reads UVs: v = 0 at the bottom. */
export interface Tile {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/** A rectangle in canvas space, as a 2D context reads it: y = 0 at the top. */
export interface Patch {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Grid {
  readonly columns: number;
  readonly rows: number;
}

export class TileOutOfRangeError extends RangeError {
  constructor(index: number, count: number) {
    super(`tile ${index} is outside 0..${count - 1}`);
    this.name = 'TileOutOfRangeError';
  }
}

/**
 * The squarest grid that holds `count` tiles.
 *
 * Square rather than one long row: a 72×1 atlas is 72 tiles wide, and hardware
 * that caps a texture at 4096 would have had to shrink each one to 56 pixels.
 */
export const gridFor = (count: number): Grid => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`an atlas needs at least one tile, got ${count}`);
  }
  const columns = Math.ceil(Math.sqrt(count));
  return { columns, rows: Math.ceil(count / columns) };
};

/** Where a tile sits on the canvas, in pixels. */
export const patchFor = (index: number, grid: Grid, side: number): Patch => {
  const count = grid.columns * grid.rows;
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new TileOutOfRangeError(index, count);
  }
  return {
    x: (index % grid.columns) * side,
    y: Math.floor(index / grid.columns) * side,
    width: side,
    height: side,
  };
};

/**
 * Where a tile sits in texture space.
 *
 * The flip is the whole reason this is tested. A canvas is drawn top-down and a
 * texture is sampled bottom-up, so tile 0 — painted in the canvas's top-left —
 * is the *top* row in UV, not the bottom one. Getting it upside down does not
 * look upside down: it looks like every square carrying the wrong number.
 */
export const tileFor = (index: number, grid: Grid): Tile => {
  const count = grid.columns * grid.rows;
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new TileOutOfRangeError(index, count);
  }
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return {
    u0: column / grid.columns,
    u1: (column + 1) / grid.columns,
    v0: 1 - (row + 1) / grid.rows,
    v1: 1 - row / grid.rows,
  };
};

/** What a tile is painted with. */
export interface LabelStyle {
  /** The number's colour. */
  readonly colour: string;
  /** Fraction of the tile the digits fill. */
  readonly fill?: number;
  /** Font stack, without a size. */
  readonly family?: string;
  /**
   * How heavy the digits are.
   *
   * Light. These sat at 600 while the field was paper and a heavy numeral on
   * paper is merely dull; on a web of white thread in the vacuum it is a slab.
   * The numbers belong to the same family as the silk they hang on.
   */
  readonly weight?: number;
}

/**
 * The minimum a painter needs, so a test can be one.
 *
 * Typed structurally rather than as `CanvasRenderingContext2D`: the real one
 * carries a hundred members this uses none of, and a stub of a hundred members
 * is a stub nobody writes.
 */
export interface Painter {
  clearRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string | unknown;
  font: string;
  textAlign: string;
  textBaseline: string;
}

/**
 * Paints every label onto one canvas.
 *
 * @returns the side of one tile, in pixels — the caller sized the canvas, and
 *          the geometry needs to agree with what was actually drawn.
 */
export function paintLabels(
  painter: Painter,
  labels: readonly string[],
  side: number,
  style: LabelStyle,
): number {
  const grid = gridFor(labels.length);
  const fill = style.fill ?? 0.52;
  const family = style.family ?? "'Outfit', system-ui, -apple-system, sans-serif";
  const weight = style.weight ?? 300;

  painter.clearRect(0, 0, grid.columns * side, grid.rows * side);
  painter.fillStyle = style.colour;
  painter.font = `${weight} ${Math.round(side * fill)}px ${family}`;
  painter.textAlign = 'center';
  painter.textBaseline = 'middle';

  for (const [index, label] of labels.entries()) {
    const patch = patchFor(index, grid, side);
    painter.fillText(label, patch.x + side / 2, patch.y + side / 2);
  }

  return side;
}
