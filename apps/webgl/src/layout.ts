import { BOARD_ROWS, TOTAL_PLANS } from '@leela/engine';

/**
 * Where each plan sits in space.
 *
 * Kept apart from the renderer on purpose. Everything here is arithmetic over
 * `BOARD_ROWS`, which is the same table the mobile app draws from, so the 3D
 * board cannot drift from the 2D one - and it can be tested without a GPU,
 * which is the only way this gets tested at all.
 *
 * The board is boustrophedon: plan 1 is bottom-left, the row runs right, the
 * next row runs left, and so on up to 72. Reading the rows out of the engine
 * rather than recomputing the serpentine means a change to the board is a
 * change in one place.
 */

/** World-space size of one cell. */
export const CELL = 1;

/** Gap between cells, as a fraction of CELL. */
export const GAP = 0.08;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class UnknownPlanError extends Error {
  constructor(plan: number) {
    super(`plan ${plan} is not on the board`);
    this.name = 'UnknownPlanError';
  }
}

const PITCH = CELL * (1 + GAP);

/** Rows as the engine declares them, bottom row first. */
const ROWS_BOTTOM_UP = [...BOARD_ROWS].reverse();

const COLUMNS = ROWS_BOTTOM_UP[0]?.length ?? 0;
const ROWS = ROWS_BOTTOM_UP.length;

/** Centres the board on the origin so the camera has nothing to compensate. */
const originX = -((COLUMNS - 1) * PITCH) / 2;
const originZ = ((ROWS - 1) * PITCH) / 2;

const index = new Map<number, { row: number; column: number }>();
for (let row = 0; row < ROWS_BOTTOM_UP.length; row += 1) {
  const cells = ROWS_BOTTOM_UP[row] ?? [];
  for (let column = 0; column < cells.length; column += 1) {
    const plan = cells[column];
    if (typeof plan === 'number') index.set(plan, { row, column });
  }
}

/** Every plan the board declares, ascending. */
export const plans = (): number[] => [...index.keys()].sort((a, b) => a - b);

/** True when the board has a cell for this plan. */
export const hasPlan = (plan: number): boolean => index.has(plan);

/**
 * The centre of a plan's cell, on the board plane (y = 0).
 *
 * Throws rather than returning a default: a piece silently parked at the
 * origin is the kind of wrong that looks like a rendering bug for hours.
 */
export const planPosition = (plan: number): Vec3 => {
  const cell = index.get(plan);
  if (!cell) throw new UnknownPlanError(plan);

  return {
    x: originX + cell.column * PITCH,
    y: 0,
    z: originZ - cell.row * PITCH,
  };
};

/**
 * Which plan a point on the board plane falls in, or null for off the board.
 *
 * The inverse of `planPosition`, and it exists because the board stopped being
 * seventy-two separate tiles. The published board — `assets/about/images/
 * gameboard.png` in `LeelaAiWeb3`, the illustration the rules screen uses — has
 * no grid on it at all: no cell borders, no squares, no separations. Just the
 * numbers, the snakes and the arrows on bare ground. Drawing it as a tray of
 * tiles with dark grout between them was the single thing that made it read as
 * a children's boardgame rather than as a painted cloth.
 *
 * With one surface there is nothing to raycast per-square, so the hit point is
 * turned back into a plan here.
 */
export const planAtPoint = (x: number, z: number): number | null => {
  const column = Math.round((x - originX) / PITCH);
  const row = Math.round((originZ - z) / PITCH);
  if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return null;

  // Inside the cell rather than merely nearest to it. Rounding alone answers
  // for a point a metre off the edge, and a tap on the table would select the
  // corner square.
  if (Math.abs(x - (originX + column * PITCH)) > PITCH / 2) return null;
  if (Math.abs(z - (originZ - row * PITCH)) > PITCH / 2) return null;

  const plan = ROWS_BOTTOM_UP[row]?.[column];
  return typeof plan === 'number' ? plan : null;
};

/**
 * How far from the centre of a cell a shared square fans its tokens.
 *
 * A quarter of the pitch. It is not enough to separate them: the lotus is about
 * eight tenths of a cell across, and a cell is one and a bit, so two tokens on
 * one square overlap however they are arranged. Separating them was never on
 * offer — what was on offer is whether the board shows *one* token where two
 * players stand, which is what it did.
 *
 * Bounded rather than chosen: `planAtPoint` answers for the cell a point falls
 * in, and an anchor pushed past half a pitch belongs to the neighbouring plan.
 * A token that reports itself on the wrong square when tapped is a worse defect
 * than the one this fixes.
 */
export const FAN = PITCH / 4;

/**
 * The offset from a cell's centre for one of several tokens sharing it.
 *
 * Evenly spaced around a ring, which has three properties worth having and one
 * worth stating. The offsets of a full ring sum to zero, so the cluster still
 * reads as centred on its square rather than dragging off one edge. It depends
 * on nothing but the two numbers given, so the same table arranges the same way
 * on every load. And a token standing alone is not nudged off centre — the
 * common case must not pay for the rare one.
 *
 * What it is not: an arrangement in which every token is wholly visible. The
 * front one covers part of the back one at this camera. Each shows its own
 * colour and its own outline, which is the difference between a square with two
 * players on it and a square with one.
 */
export const fanOffset = (at: number, sharing: number): Vec3 => {
  if (sharing <= 1 || at < 0 || at >= sharing) return { x: 0, y: 0, z: 0 };

  // Starting at +x rather than at the top of the ring, so that the commonest
  // case — two on a square — puts them left and right of each other. The camera
  // looks down at seventy degrees, which foreshortens z into a couple of pixels
  // of separation: two tokens fanned along depth read as one token with a
  // shadow. Across is the direction an offset survives being looked at.
  const angle = (at / sharing) * Math.PI * 2;
  return { x: Math.cos(angle) * FAN, y: 0, z: Math.sin(angle) * FAN };
};

/**
 * Where a crossing of the web sits, by column and row.
 *
 * Half a pitch out from the plans, in both directions, so a plan falls in the
 * *middle of an opening* rather than on a crossing. The first web put its knots
 * on the plan centres, which is the tidier-sounding arrangement and the wrong
 * one: every number then had two threads running through it.
 *
 * There is therefore one more corner than there are columns, and one more than
 * there are rows — `CROSSINGS` says so rather than leaving each caller to
 * remember the `+ 1`.
 */
export const cornerPosition = (column: number, row: number): Vec3 => ({
  x: originX - PITCH / 2 + column * PITCH,
  y: 0,
  z: originZ + PITCH / 2 - row * PITCH,
});

/** How many crossings the web has, across and down. */
export const CROSSINGS = { columns: COLUMNS + 1, rows: ROWS + 1 };

/** Width and depth the board occupies, for framing the camera. */
export const boardExtent = (): { width: number; depth: number } => ({
  width: (COLUMNS - 1) * PITCH + CELL,
  depth: (ROWS - 1) * PITCH + CELL,
});

/**
 * A piece hops rather than slides: the arc reads as a move even when the two
 * cells are adjacent. `t` runs 0..1; the height is a parabola so both ends sit
 * exactly on the board.
 */
export const hopHeight = (t: number, peak = 0.9): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return peak * 4 * clamped * (1 - clamped);
};

/** Straight-line interpolation between two cells, with the hop applied. */
export const hopPoint = (from: Vec3, to: Vec3, t: number, peak?: number): Vec3 => {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: from.x + (to.x - from.x) * clamped,
    y: hopHeight(clamped, peak),
    z: from.z + (to.z - from.z) * clamped,
  };
};

/** Sanity check used by the tests and by the renderer on boot. */
export const boardIsComplete = (): boolean => index.size === TOTAL_PLANS;
