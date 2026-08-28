import * as THREE from 'three';

/**
 * Which way a head faces at the end of the jump it finishes.
 *
 * `tube.ts` opens by saying the radius profiles live there because they are
 * "the part with a right answer — a snake that tapers the wrong way is a snake
 * you slide *up*". This is the same class of fact about the other end of the
 * same geometry, and it was wrong on the board for as long as anybody had
 * looked at it.
 *
 * **What was wrong, measured 2026-08-28.** Both jumps finish in a cone. The
 * snake's was stood at its square and aimed along the tangent leaving the body:
 *
 *     head.position.copy(start);  aim(head, intoStart);
 *
 * and the arrow's, four hundred lines later, was aimed along the *negation* of
 * its own:
 *
 *     head.position.copy(end);    aim(head, intoEnd.clone().negate());
 *
 * `intoEnd` is `end.sub(curve.getPointAt(0.96))` — it already points outward,
 * past the square, the way the arrow is travelling. Negating it turned every
 * arrowhead on the board around: the flat disc of the base led and the point
 * aimed back down its own shaft. Standing a cone of height 0.3 on a curve and
 * measuring, the apex came to rest 0.927 from the middle of the jump and the
 * base 1.227 — the wrong way round, on all of them.
 *
 * Seen from the board's camera that is a triangle pointing backwards, which is
 * how it was reported.
 *
 * **Why it is a module and not a deleted minus sign.** The defect was not the
 * sign; it was that one idea had two spellings four hundred lines apart, and
 * nothing could compare them because `scene.ts` builds a `WebGLRenderer` on its
 * first line and no test has ever imported it (`specs/007` is about exactly
 * that). Named once and called twice, the two heads cannot drift again, and
 * `tests/pointing.test.ts` can hold the rule without a GL context — `framing.ts`
 * is the precedent for a `three`-importing module that a test can still reach.
 */

/** Cones, cylinders and everything else `three` builds stand up the Y axis. */
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Where a cone's point and its base come to rest, given where it is standing
 * and how it is turned.
 *
 * Pure, and the only reason the rule below can be asserted at all: a mesh's
 * orientation is a quaternion and a quaternion is arithmetic, so the question
 * "which end leads" is answerable on a machine with no graphics in it.
 *
 * **It takes the object, not a direction, and that is the whole point.** The
 * first draft took a position and a direction, so a test could hand it the same
 * vector it had just handed `faceOutward` and never read what `faceOutward`
 * actually did — which meant breaking the orientation deliberately left seven
 * tests green. Reading the quaternion off the thing that was stood there is
 * what makes this govern rather than report.
 *
 * That a cone's point is at `+height/2` is a fact about `three` rather than
 * about this repository, so the test reads it out of a real `ConeGeometry`
 * instead of taking this comment's word for it.
 */
export const coneEnds = (
  stood: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  height: number,
): { point: THREE.Vector3; base: THREE.Vector3 } => ({
  point: new THREE.Vector3(0, height / 2, 0).applyQuaternion(stood.quaternion).add(stood.position),
  base: new THREE.Vector3(0, -height / 2, 0).applyQuaternion(stood.quaternion).add(stood.position),
});

/**
 * Stand a head at the square it belongs to, facing away from its own body.
 *
 * `outward` is the tangent that leaves the curve at that end — what `scene.ts`
 * calls `intoStart` and `intoEnd`, both of which are the endpoint minus a point
 * just inside it, and therefore both already outward. Neither call site
 * negates anything now, because the rule is the same at both ends of the board
 * and a head that points at its own tail is the defect this exists to stop.
 */
export const faceOutward = (
  head: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  at: THREE.Vector3,
  outward: THREE.Vector3,
): void => {
  head.position.copy(at);
  head.quaternion.setFromUnitVectors(UP, outward.clone().normalize());
};
