import * as THREE from 'three';
import { describe as group, expect, it } from 'vitest';

import { coneEnds, faceOutward } from '../src/pointing';

/**
 * The rule that every arrowhead on the board was breaking.
 *
 * Thirty-odd arrows were drawn with the flat disc of the head leading and the
 * point aimed back down the shaft, because `scene.ts` spelled one idea two ways
 * four hundred lines apart — the snake's head aimed along its outward tangent
 * and the arrow's along the negation of its own. Nothing could see it: the
 * board's thirteenth invariant in `NOTES.md` reads "looking at it — nothing
 * else can", `scene.ts` builds a renderer on its first line, and no test has
 * ever imported it.
 *
 * What made this reachable is that orientation is arithmetic. A quaternion can
 * be asked where it puts a point on a machine with no graphics in it, so the
 * question "which end leads" has an answer here even though "did it draw" does
 * not.
 */
const jump = () =>
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0.4, 0),
    new THREE.Vector3(2, 0, 0),
  ]);

/** Exactly what `scene.ts` computes, and both of them point outward. */
const tangents = (curve: THREE.CatmullRomCurve3) => ({
  start: curve.getPointAt(0),
  end: curve.getPointAt(1),
  middle: curve.getPointAt(0.5),
  outwardAtStart: curve.getPointAt(0).clone().sub(curve.getPointAt(0.04)).normalize(),
  outwardAtEnd: curve.getPointAt(1).clone().sub(curve.getPointAt(0.96)).normalize(),
});

const HEAD = 0.3;

group('which end of a three.js cone is the point', () => {
  it('reads it out of the library rather than believing a comment', () => {
    // The whole of `pointing.ts` rests on this. It is a fact about `three`, not
    // about this repository, so it is measured from a real geometry: if a
    // future version ever flips the axis, this fails here instead of turning
    // every head on the board around in silence.
    const cone = new THREE.ConeGeometry(0.147, HEAD, 14);
    const position = cone.attributes.position as THREE.BufferAttribute;

    const radiusAt = (y: number) => {
      let widest = 0;
      for (let index = 0; index < position.count; index += 1) {
        if (Math.abs(position.getY(index) - y) < 1e-6) {
          widest = Math.max(widest, Math.hypot(position.getX(index), position.getZ(index)));
        }
      }
      return widest;
    };

    expect(radiusAt(HEAD / 2)).toBeCloseTo(0, 5);
    expect(radiusAt(-HEAD / 2)).toBeCloseTo(0.147, 3);
  });
});

group('a head faces away from its own body', () => {
  it('leads with the point at the end an arrow finishes on', () => {
    const curve = jump();
    const { end, middle, outwardAtEnd } = tangents(curve);

    const head = new THREE.Object3D();
    faceOutward(head, end, outwardAtEnd);
    // Read off the head that was stood there, never off the vector handed in:
    // that is the difference between testing `faceOutward` and testing the
    // argument it was called with.
    const { point, base } = coneEnds(head, HEAD);

    // The assertion in the units the defect was measured in: 1.227 against
    // 0.927, which was the wrong way round on the live board.
    expect(point.distanceTo(middle)).toBeGreaterThan(base.distanceTo(middle));
  });

  it('leads with the point at the end a snake finishes on', () => {
    const curve = jump();
    const { start, middle, outwardAtStart } = tangents(curve);

    const head = new THREE.Object3D();
    faceOutward(head, start, outwardAtStart);
    const { point, base } = coneEnds(head, HEAD);

    expect(point.distanceTo(middle)).toBeGreaterThan(base.distanceTo(middle));
  });

  it('complains when handed the tangent the other way round', () => {
    // The companion the constitution's third principle asks for: a guard with
    // no failing case has not been shown to work. This IS the shipped defect —
    // `aim(head, intoEnd.clone().negate())` — and the rule has to reject it.
    const curve = jump();
    const { end, middle, outwardAtEnd } = tangents(curve);
    const shipped = new THREE.Object3D();
    shipped.position.copy(end);
    shipped.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      outwardAtEnd.clone().negate().normalize(),
    );

    const { point, base } = coneEnds(shipped, HEAD);

    expect(point.distanceTo(middle)).toBeLessThan(base.distanceTo(middle));
  });

  it('holds at both ends of a jump that doubles back on itself', () => {
    // A straight test curve is the easy case: its two tangents are opposites,
    // so a sign error at one end can look like the other end's answer. This one
    // arrives and leaves in nearly the same direction.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1.2, 0.5, 0.9),
      new THREE.Vector3(0.4, 0, 1.6),
    ]);
    const { start, end, middle, outwardAtStart, outwardAtEnd } = tangents(curve);

    for (const [at, outward] of [
      [start, outwardAtStart],
      [end, outwardAtEnd],
    ] as const) {
      const head = new THREE.Object3D();
      faceOutward(head, at, outward);
      const { point, base } = coneEnds(head, HEAD);
      expect(point.distanceTo(middle)).toBeGreaterThan(base.distanceTo(middle));
    }
  });

  it('puts the head on the square, whatever it is aimed at', () => {
    // The position half, asserted separately: a head that faces correctly and
    // stands somewhere else is the piece-parked-at-the-origin defect wearing a
    // different hat.
    const curve = jump();
    const { end, outwardAtEnd } = tangents(curve);

    const head = new THREE.Object3D();
    faceOutward(head, end, outwardAtEnd);

    expect(head.position.distanceTo(end)).toBeCloseTo(0, 10);
  });

  it('does not care how long the tangent it is given is', () => {
    const curve = jump();
    const { end, middle, outwardAtEnd } = tangents(curve);

    const head = new THREE.Object3D();
    faceOutward(head, end, outwardAtEnd.clone().multiplyScalar(37));
    const { point, base } = coneEnds(head, HEAD);

    expect(point.distanceTo(middle)).toBeGreaterThan(base.distanceTo(middle));
  });
});
