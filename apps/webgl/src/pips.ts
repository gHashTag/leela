/**
 * The face of the die, as pips.
 *
 * The board this replaced printed the digit. The mini app's note on its own die
 * says why that is not the same thing: the published app makes you tap the die
 * and watch it settle, and the version that told the player what they threw in
 * a sentence *never showed the throw*. A digit in a box is the sentence again,
 * shorter. Pips are read at a glance; a numeral is read.
 *
 * Nine cells, row-major, 1 at the top-left — the layout a CSS grid gives, and
 * the layout every die in the world uses.
 */

/** Cells of a 3×3 grid, 1..9, that carry a pip for each face. */
const FACES: Readonly<Record<number, readonly number[]>> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export const MIN_FACE = 1;
export const MAX_FACE = 6;

/**
 * Which cells a face fills.
 *
 * Anything that is not one of the six shows nothing at all rather than
 * borrowing a face. A die has to show *something* only once it has been thrown;
 * before that, an empty die is the truth — and a die showing a one before the
 * first throw is a lie the player will act on.
 */
export const pipsFor = (value: number): readonly number[] => FACES[Math.trunc(value)] ?? [];

/** Whether a value is a face this die can show. */
export const isFace = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_FACE && value <= MAX_FACE;
