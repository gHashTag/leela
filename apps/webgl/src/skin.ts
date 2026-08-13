/**
 * Scales.
 *
 * The snakes have had naturalistic colours for two passes and still read as
 * rubber tube, because colour is not what makes a snake look like a snake —
 * the light breaking over several hundred overlapping plates is. The published
 * painting has that in every one of its serpents, at a size where you can count
 * them.
 *
 * This paints one tile that repeats along a body. What is here rather than in
 * the renderer is the lattice, because it has a right answer and a wrong one
 * that is hard to see: scales interlock, so each row sits half a scale along
 * from the row before it. Rows that line up are a brick wall, and a brick wall
 * at a glance on a curved surface just looks like a slightly odd tube — which
 * is exactly the failure this is meant to fix, so it would go unnoticed.
 */

export interface Scale {
  /** Centre, in 0..1 across the tile. */
  readonly u: number;
  /** Centre, in 0..1 along the tile. */
  readonly v: number;
  /** Which row it belongs to, counting from 0. */
  readonly row: number;
}

export interface Lattice {
  readonly across: number;
  readonly along: number;
}

/**
 * Where every scale on one tile sits.
 *
 * `across` runs the way the body is thick and wraps, so a scale at u = 1 is the
 * same scale as one at u = 0; `along` runs the way the body is long.
 */
export const scales = ({ across, along }: Lattice): Scale[] => {
  if (!Number.isInteger(across) || across < 1) {
    throw new RangeError(`a body needs at least one scale around it, got ${across}`);
  }
  if (!Number.isInteger(along) || along < 1) {
    throw new RangeError(`a body needs at least one row of scales, got ${along}`);
  }

  const made: Scale[] = [];
  for (let row = 0; row < along; row += 1) {
    // The half-step that makes them interlock. Odd rows only, so the pattern
    // repeats every two rows and the tile still tiles.
    const stagger = row % 2 === 0 ? 0 : 0.5 / across;
    for (let column = 0; column < across; column += 1) {
      made.push({
        u: (column / across + stagger) % 1,
        v: (row + 0.5) / along,
        row,
      });
    }
  }
  return made;
};

/** Every drawing call a scale tile needs, so a test can be the canvas. */
export interface Brush {
  fillStyle: string | unknown;
  strokeStyle: string | unknown;
  lineWidth: number;
  fillRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  fill(): void;
  stroke(): void;
}

/**
 * Paints the tile as a height field: mid grey is the body, lighter is the
 * raised back of a scale, darker is the seam between two.
 *
 * A bump map rather than a colour map, so one tile serves every snake on the
 * board whatever colour it is — the alternative is a texture per skin, and the
 * skins are only six because they are meant to be cheap.
 */
export function paintScales(brush: Brush, size: number, lattice: Lattice): void {
  brush.fillStyle = '#808080';
  brush.fillRect(0, 0, size, size);

  // Wider than tall, and overlapping its neighbours by a quarter — a scale is
  // a shingle, not a dot.
  const halfWidth = (size / lattice.across) * 0.62;
  const halfHeight = (size / lattice.along) * 0.78;

  for (const scale of scales(lattice)) {
    const x = scale.u * size;
    const y = scale.v * size;

    // Drawn three times at three offsets so a scale crossing the seam appears
    // on both edges. Without it every tile join shows as a bald ring.
    for (const wrap of [-size, 0, size]) {
      brush.fillStyle = '#9a9a9a';
      brush.beginPath();
      brush.ellipse(x + wrap, y, halfWidth, halfHeight, 0, 0, Math.PI * 2);
      brush.fill();

      brush.strokeStyle = '#5d5d5d';
      brush.lineWidth = Math.max(1, size / lattice.along / 14);
      brush.beginPath();
      brush.ellipse(x + wrap, y, halfWidth, halfHeight, 0, 0, Math.PI * 2);
      brush.stroke();
    }
  }
}
