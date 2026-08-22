/**
 * The face of the die, as pips.
 *
 * Briefly a numeral, while the board around it was becoming thread and glass —
 * the reasoning being that a moulded plastic die was the last skeuomorphic
 * object on the screen. Back to pips because they were better: the mini app's
 * note on its own die says why, and it is about the throw rather than about the
 * style. The published app makes you tap the die and watch it settle, and the
 * version that told the player what they threw in a sentence *never showed the
 * throw*. A digit in a box is that sentence again, shorter. Pips are read at a
 * glance; a numeral is read.
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

/**
 * Which cells a face fills.
 *
 * Anything that is not one of the six shows nothing at all rather than
 * borrowing a face. A die has to show *something* only once it has been thrown;
 * before that, an empty die is the truth — and a die showing a one before the
 * first throw is a lie the player will act on.
 *
 * Asked through `isFace` rather than truncating. The version this was restored
 * from did `FACES[Math.trunc(value)]`, so `pipsFor(1.5)` drew a one while
 * `isFace(1.5)` said false — two functions in the same file disagreeing about
 * what a face is. No roller produces a fraction, which is why it sat there; the
 * test that found it is one line longer than the test that did not.
 *
 * A face is a value `FACES` has pips for — the table above is the die, so it
 * is also the answer. `MIN_FACE`/`MAX_FACE` restated the table's bounds as two
 * more sixes for `audit-doubles` to find against the mini app's die; the table
 * cannot disagree with itself.
 */
/** Whether a value is a face this die can show. */
/**
 * The face a die shows when it is not showing a throw.
 *
 * A die drawn from nothing was drawn *as* nothing: the first load passed 0,
 * `isFace(0)` is false, and the control came up as an empty rounded square
 * beside a sentence reading *A six puts you on the board*. A die at rest on a
 * table has a number facing up.
 *
 * Six, because that is the number the sentence beside it names and the only
 * throw that starts a game.
 */
export const RESTING_FACE = 6;

export const isFace = (value: number): boolean =>
  Number.isInteger(value) && FACES[value] !== undefined;

export const pipsFor = (value: number): readonly number[] =>
  isFace(value) ? (FACES[value] ?? []) : [];
