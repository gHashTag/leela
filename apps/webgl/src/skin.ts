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

/**
 * What is drawn *on* the scales.
 *
 * Scales are relief and read only close up; markings are value and read at the
 * distance the board is actually played at, which is why they matter more. The
 * published painting has all three of these — a banded red, blotched vipers, and
 * plainer dark snakes with nothing but a darker back.
 */
export type Marking = 'banded' | 'blotched' | 'plain';

/**
 * Where the bands fall, in 0..1 along the tile.
 *
 * Evenly spaced and offset half a step from the ends, so the tile joins without
 * two bands landing on top of each other at the seam.
 */
export const bandsOn = (count: number): number[] => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`a banded snake needs at least one band, got ${count}`);
  }
  return Array.from({ length: count }, (_, at) => (at + 0.5) / count);
};

export interface Blotch {
  /** Along the tile, 0..1. */
  readonly v: number;
  /** Around the body, 0..1. A blotch sits off the spine, not on it. */
  readonly u: number;
  /** Half-width across the body, as a fraction of the tile. */
  readonly spread: number;
}

/**
 * Saddle blotches, alternating either side of the spine.
 *
 * Deterministic — no `Math.random`. A board whose snakes are marked differently
 * on every load is a board a player cannot learn, and a pattern that changes
 * under you is the kind of thing that reads as a rendering fault.
 */
export const blotchesOn = (count: number): Blotch[] => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`a blotched snake needs at least one blotch, got ${count}`);
  }
  return Array.from({ length: count }, (_, at) => ({
    v: (at + 0.5) / count,
    // Alternating about the spine at u = 0.5, by a fixed lean rather than a
    // random one, so the pattern is the same board every time.
    u: 0.5 + (at % 2 === 0 ? -0.09 : 0.09),
    spread: at % 3 === 0 ? 0.3 : 0.24,
  }));
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

/** How many bands or blotches one marking tile carries. */
export const BANDS = 5;
export const BLOTCHES = 4;

/**
 * Paints the markings tile.
 *
 * White is the snake's own colour and grey is a marking, because this is a
 * `map` and a `map` multiplies `color` — which is what lets one tile per
 * pattern serve all six skins instead of one texture per snake. The cost is
 * that a marking is a darker shade of the same hue rather than a second colour,
 * so this cannot draw a red-on-black coral snake. It can draw every one of them
 * as a snake with bands, which is the thing that was missing.
 */
export function paintMarking(brush: Brush, size: number, marking: Marking): void {
  brush.fillStyle = '#ffffff';
  brush.fillRect(0, 0, size, size);

  if (marking === 'plain') {
    // Not nothing: a darker back and a pale belly is the least a snake has.
    // Drawn across u, which is the way the body wraps, so the dark lands along
    // the spine.
    brush.fillStyle = '#d0d0d0';
    brush.fillRect(0, 0, size * 0.16, size);
    brush.fillRect(size * 0.84, 0, size * 0.16, size);
    return;
  }

  if (marking === 'banded') {
    brush.fillStyle = '#6e6e6e';
    const thickness = size / BANDS / 2.4;
    for (const v of bandsOn(BANDS)) {
      brush.fillRect(0, v * size - thickness / 2, size, thickness);
    }
    return;
  }

  brush.fillStyle = '#7a7a7a';
  for (const blotch of blotchesOn(BLOTCHES)) {
    // Three offsets, for the same reason the scales get three: a blotch that
    // straddles the seam has to appear on both edges of the tile.
    for (const wrap of [-size, 0, size]) {
      brush.beginPath();
      brush.ellipse(
        blotch.u * size + wrap,
        blotch.v * size,
        blotch.spread * size,
        (size / BLOTCHES) * 0.3,
        0,
        0,
        Math.PI * 2,
      );
      brush.fill();
    }
  }
}
