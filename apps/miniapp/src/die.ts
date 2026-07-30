/**
 * The die, as the published app throws it.
 *
 * `components/Dice/index.tsx` is a pressable image: you tap the die itself,
 * it spins, and it comes to rest on the face you threw. The mini app had a
 * button reading "Roll" and no die at all — the player was told what they threw
 * in a sentence and never saw it.
 *
 * The two things worth keeping out of the DOM are here: which face to show, and
 * how long the spin lasts. The original ties the spin to the value —
 * `(value / 2) * 500` milliseconds — so a six takes three times as long to
 * settle as a two, and the wait is part of the throw.
 */

/** The six faces, in order, as the bundler's URLs for them. */
export type DieFaces = readonly [string, string, string, string, string, string];

export const MIN_FACE = 1;
export const MAX_FACE = 6;

/**
 * The face for a value.
 *
 * Anything that is not one of the six is the one face: a die has to show
 * something, and a blank square where the die was reads as a broken app rather
 * than as a throw that failed.
 */
export function faceFor(value: number, faces: DieFaces): string {
  const index = Math.trunc(value) - MIN_FACE;
  return faces[index] ?? faces[0];
}

/**
 * How long the spin lasts, in milliseconds.
 *
 * `(value / 2) * 500`, from `handleSpin`. Kept as a function of the value
 * rather than a constant because that is what makes a six feel like a six.
 */
export function spinMs(value: number): number {
  const clamped = Math.min(Math.max(Math.trunc(value) || MIN_FACE, MIN_FACE), MAX_FACE);
  return (clamped / 2) * 500;
}

/**
 * How far it turns.
 *
 * The original animates a value of `n` through an interpolation of one turn,
 * which is `n` turns in `n / 2 * 500` ms. Expressed in degrees so a stylesheet
 * can be handed it.
 */
export function spinDegrees(value: number): number {
  const clamped = Math.min(Math.max(Math.trunc(value) || MIN_FACE, MIN_FACE), MAX_FACE);
  return clamped * 360;
}
