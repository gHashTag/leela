/**
 * The sky the board hangs in.
 *
 * Leela is a cosmology before it is a game — seventy-two planes from the
 * physical up to Cosmic Consciousness — so a board floating in a dark room is
 * a weaker idea than a board floating in space. This places the stars.
 *
 * Two things here have a right answer and a wrong one that looks plausible,
 * which is why they are in a module with tests rather than four lines in the
 * renderer:
 *
 *   - **Uniform sampling of a sphere.** Taking the polar angle straight from a
 *     uniform number bunches stars at the poles, badly — the density there is
 *     several times the density at the equator. It is the single most common
 *     mistake in a starfield and it does not look like a maths error, it looks
 *     like a deliberate cluster, so nobody questions it. `acos(1 - 2u)` is the
 *     correction.
 *   - **The same sky every time.** No `Math.random`. A sky that is different on
 *     every load is one a player cannot come back to, and — as with the snakes'
 *     markings — a pattern that changes under you reads as a fault rather than
 *     as variety.
 */

export interface Star {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0..1. Most stars are faint; a few are not. */
  readonly brightness: number;
  /** Screen size, in the renderer's units. */
  readonly size: number;
}

/**
 * A small deterministic generator.
 *
 * Not cryptography and not trying to be: it needs to be repeatable across
 * loads and machines, and to have no visible structure at the sizes used here.
 * A 32-bit mix — the same shape as `mulberry32`, which is the usual choice for
 * exactly this job.
 */
export const sequence = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
};

export interface Sky {
  /** How many stars. */
  readonly count: number;
  /** How far away they sit. Far enough to read as unreachable. */
  readonly radius: number;
  readonly seed?: number;
}

/**
 * Places the stars on a sphere around the board.
 *
 * Uniform over the *surface*, which is the whole difficulty: `z = 1 - 2u` and
 * then the polar angle from its arccosine. Sampling the angle directly gives a
 * sphere with its poles packed and its equator bare.
 */
export function starsFor({ count, radius, seed = 0x1ee1a }: Sky): Star[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`a sky needs at least one star, got ${count}`);
  }
  if (!(radius > 0)) throw new RangeError(`a sky needs a radius, got ${radius}`);

  const next = sequence(seed);
  const made: Star[] = [];

  for (let at = 0; at < count; at += 1) {
    const height = 1 - 2 * next();
    const ring = Math.sqrt(Math.max(0, 1 - height * height));
    const around = next() * Math.PI * 2;

    // Brightness cubed: most stars faint, a few bright. A uniform brightness
    // gives an evenly grey sky, which reads as noise rather than as stars.
    const roll = next();
    const brightness = 0.22 + 0.78 * roll * roll * roll;

    made.push({
      x: radius * ring * Math.cos(around),
      y: radius * height,
      z: radius * ring * Math.sin(around),
      brightness,
      size: 0.6 + brightness * 2.2,
    });
  }

  return made;
}

/**
 * How evenly a set of stars covers the sphere, by latitude band.
 *
 * Returns the fraction of stars in each of `bands` equal-area bands from the
 * south pole to the north. On a uniform sphere every band holds the same share;
 * on the naive sampling the polar bands hold several times their share. This is
 * the measurement the test makes rather than eyeballing a render.
 */
export const byBand = (stars: readonly Star[], radius: number, bands: number): number[] => {
  const counted = new Array<number>(bands).fill(0);
  for (const star of stars) {
    // Equal-area bands are equal steps in height, not in angle.
    const height = star.y / radius;
    const band = Math.min(bands - 1, Math.floor(((height + 1) / 2) * bands));
    counted[band] = (counted[band] ?? 0) + 1;
  }
  return counted.map((n) => n / stars.length);
};
