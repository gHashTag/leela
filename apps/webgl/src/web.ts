/**
 * The field as a web.
 *
 * The board stopped being a painted slab and became a lattice of white threads
 * hung in the vacuum: seventy-two knots, and silk between them. It suits where
 * the board now is — Leela is a cosmology, and a web is what a cosmology looks
 * like when you draw the relations rather than the places.
 *
 * The arithmetic is here because a lattice has one failure that hides. Emit an
 * edge twice — once walking the rows and once walking the columns — and it
 * renders identically, at twice the cost, forever. Miss the last row or column
 * and the web has an open side, which reads as a design choice. Both are
 * counted rather than looked at.
 */

/** A node of the lattice, by column and row. */
export interface Knot {
  readonly column: number;
  readonly row: number;
}

/** A thread between two adjacent knots. */
export interface Thread {
  readonly from: Knot;
  readonly to: Knot;
  /** True for the four sides of the lattice, which are drawn brighter. */
  readonly rim: boolean;
}

/**
 * Every thread of a `columns` by `rows` lattice, each one exactly once.
 *
 * Horizontals then verticals, and nothing diagonal: the board is a grid and a
 * web drawn over it should agree with it, or the eye is asked to read two
 * different structures at once.
 */
export function threadsFor(columns: number, rows: number): Thread[] {
  if (!Number.isInteger(columns) || columns < 2) {
    throw new RangeError(`a lattice needs at least two columns, got ${columns}`);
  }
  if (!Number.isInteger(rows) || rows < 2) {
    throw new RangeError(`a lattice needs at least two rows, got ${rows}`);
  }

  const made: Thread[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      made.push({
        from: { column, row },
        to: { column: column + 1, row },
        rim: row === 0 || row === rows - 1,
      });
    }
  }

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      made.push({
        from: { column, row },
        to: { column, row: row + 1 },
        rim: column === 0 || column === columns - 1,
      });
    }
  }

  return made;
}

/** How many threads a lattice of this size has. Stated, so a test can disagree. */
export const threadCount = (columns: number, rows: number): number =>
  rows * (columns - 1) + columns * (rows - 1);

/**
 * How far a thread droops at `t` along its span.
 *
 * Silk hangs. A lattice of perfectly straight segments is a wireframe — the
 * thing a 3D program draws before anybody has made it look like anything — and
 * a very small sag is most of the difference between that and thread. Zero at
 * both knots, because a thread that does not meet its own knot is worse than no
 * sag at all.
 */
export const sagAt = (t: number, depth: number): number => {
  const along = Math.min(1, Math.max(0, t));
  // A parabola rather than a true catenary: over one cell they are the same to
  // within a pixel, and this one is obviously zero at both ends.
  return -depth * 4 * along * (1 - along);
};
