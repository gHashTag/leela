/**
 * A tube whose thickness varies along its length, and the snake that needs one.
 *
 * `THREE.TubeGeometry` is a constant radius, which is why the first board drew
 * every snake and every arrow as the same length of hose. On a Leela board that
 * is not a cosmetic loss: a snake has a head and a tail and the whole rule is
 * which end you land on, and thirty identical arcs crossing each other is a
 * board you cannot read the rules off at all.
 *
 * The radius profiles are here, as plain functions of `t`, because they are the
 * part with a right answer — a snake that tapers the wrong way is a snake you
 * slide *up*.
 */

/** How thick the body is, `0` at the head end and `1` at the tail. */
export type Profile = (t: number) => number;

/**
 * A snake: thick behind the head, tapering to a point at the tail.
 *
 * In Leela — as in every snakes-and-ladders board it descends from — the head
 * is the square you land on and the tail is where you end up, so the head end
 * is `from` and it is the higher number. The taper is what says so without a
 * caption.
 */
export const snakeProfile =
  (thickest: number): Profile =>
  (t) => {
    const at = Math.min(1, Math.max(0, t));
    // A slight swell just behind the head, the way a snake actually reads,
    // then a long taper. Not linear: a linear taper looks like a cone.
    return thickest * (0.35 + 0.65 * Math.cos((at * Math.PI) / 2) ** 1.6);
  };

/**
 * An arrow: an even shaft, because a shaft that tapers is a spear.
 *
 * The head and the fletching are separate meshes; this is only the stick
 * between them.
 */
export const arrowProfile =
  (radius: number): Profile =>
  () =>
    radius;

/**
 * How far the body swings off the straight line, at `t`.
 *
 * Snakes on painted Leela boards are drawn with two or three bends. One sine
 * over the length reads as a bent hose; three reads as a snake. The amplitude
 * falls to nothing at both ends so the body still meets its two squares exactly
 * — a snake whose head misses the square it is the head of is the same defect
 * as a piece parked at the origin, and just as hard to see.
 */
export const wiggle = (t: number, amplitude: number, bends = 3): number => {
  const at = Math.min(1, Math.max(0, t));
  return amplitude * Math.sin(at * Math.PI * bends) * Math.sin(at * Math.PI);
};
