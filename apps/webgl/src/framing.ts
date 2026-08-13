import * as THREE from 'three';

/**
 * Where the camera stands so the whole board lands in the part of the canvas
 * nobody is standing on.
 *
 * This is a module of its own because it is the most-broken code in the app.
 * Three defects have shipped from it, and **every one was caught by eye**:
 *
 *   - the pan was signed the wrong way, which put the board behind the sheet
 *     and left the page looking like nothing had rendered at all;
 *   - the inset was read from the bottom only, so a desktop — where the sheet
 *     is a panel against the right — got the board in a strip across the top
 *     with half the window empty beside it;
 *   - the board grew a margin to carry its border and the fit still measured
 *     the play field, so the new right edge went off the side of the screen.
 *
 * Three of a kind is a pattern, and the answer to a pattern is an instrument
 * rather than another careful look. Nothing here touches WebGL: a
 * `PerspectiveCamera` and `Vector3.project` are arithmetic, and only
 * `WebGLRenderer` needs a context. So the test builds a real camera, frames a
 * real board and asks where the corners landed.
 */

/** Pixels of the canvas something else is standing on. */
export interface Inset {
  readonly bottom?: number;
  readonly right?: number;
}

/** The box the framing has to fit: the slab, and the air the arcs travel through. */
export interface Extent {
  readonly width: number;
  readonly depth: number;
  /** How high above the board the tallest arc reaches. */
  readonly ceiling: number;
}

/** The part of the canvas the board is framed into, in clip space. */
export interface Band {
  readonly bottom: number;
  readonly right: number;
  readonly height: number;
  readonly width: number;
}

export interface Frame {
  readonly distance: number;
  /** Radians above the board's plane. */
  readonly elevation: number;
  /** What the camera ends up looking at. */
  readonly target: THREE.Vector3;
  readonly band: Band;
}

/** Bounds on how far over the board the camera stands. */
export const ELEVATION_MAX = (74 * Math.PI) / 180;
export const ELEVATION_MIN = (50 * Math.PI) / 180;

/**
 * A board touching the edge of its band reads as cropped even when every
 * square is on screen.
 */
export const MARGIN = 0.94;

/** Never let a panel claim the whole canvas; there would be no band left. */
const LEAST = 0.35;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, 0, -1],
  [1, 0, -1],
  [-1, 0, 1],
  [1, 0, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, 1, 1],
  [1, 1, 1],
];

/** The eight corners of the box, in world space. */
export const cornersOf = (extent: Extent): THREE.Vector3[] =>
  CORNERS.map(
    (corner) =>
      new THREE.Vector3(
        (corner[0] * extent.width) / 2,
        corner[1] * extent.ceiling,
        (corner[2] * extent.depth) / 2,
      ),
  );

/**
 * The part of the canvas nobody is standing on, **in pixels**.
 *
 * Kept separate from `bandFor` because the two answer different questions and
 * conflating them cost a real behaviour: the camera's elevation is a function
 * of the *shape* of the visible space, and shape does not survive the trip into
 * clip space. A full band is 2 by 2 whatever the viewport, so an elevation
 * derived from the band is the same on a phone as on a widescreen — which is
 * exactly the regression the tests caught the moment they existed.
 */
export const visibleFor = (
  viewport: { width: number; height: number },
  inset: Inset,
): { width: number; height: number } => {
  const height = Math.max(1, viewport.height);
  const width = Math.max(1, viewport.width);
  return {
    height: Math.max(height * LEAST, height - Math.max(0, inset.bottom ?? 0)),
    width: Math.max(width * LEAST, width - Math.max(0, inset.right ?? 0)),
  };
};

export const bandFor = (
  viewport: { width: number; height: number },
  inset: Inset,
): Band => {
  const height = Math.max(1, viewport.height);
  const width = Math.max(1, viewport.width);
  const visible = visibleFor(viewport, inset);

  // y = 1 is the top of the canvas and a bottom sheet eats upwards; x = -1 is
  // the left edge and a side panel eats inwards from the right.
  const bottom = 1 - (2 * visible.height) / height;
  const right = (2 * visible.width) / width - 1;
  return { bottom, right, height: 1 - bottom, width: right + 1 };
};

/** Where the projected board sits, in clip space. */
export interface Span {
  readonly x: number;
  readonly y: number;
  readonly midX: number;
  readonly midY: number;
}

export const spanOf = (camera: THREE.Camera, corners: readonly THREE.Vector3[]): Span => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const point = corner.clone().project(camera);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { x: maxX - minX, y: maxY - minY, midX: (maxX + minX) / 2, midY: (maxY + minY) / 2 };
};

/**
 * How far above the board to stand, given the shape of the space.
 *
 * A fixed angle is right for a laptop and wasteful on a phone. The board is
 * wider than it is deep, so on any portrait screen the width binds the
 * distance — and the flatter the camera, the less of the leftover height the
 * board's depth uses. Standing more nearly overhead maps that depth onto the
 * screen instead. Not all the way overhead: a top-down board is a spreadsheet,
 * and the arcs that make Leela legible stop reading as arcs.
 */
export const elevationFor = (visible: { width: number; height: number }): number =>
  ELEVATION_MAX - (ELEVATION_MAX - ELEVATION_MIN) * clamp01(visible.width / visible.height / 1.6);

/**
 * Frames the board, moving the camera.
 *
 * Fit by projecting the board, not by trusting trigonometry about it. The
 * arithmetic version — fit the depth to the vertical field of view — is wrong
 * for the same reason it looks right: the board is tilted away from the camera,
 * so its depth on screen is foreshortened by an amount that depends on the very
 * distance being solved for. It left the board at about half the size of the
 * space it had. Projecting the corners asks the camera what it can actually
 * see, and converges in three passes.
 */
export function frameBoard(
  camera: THREE.PerspectiveCamera,
  extent: Extent,
  viewport: { width: number; height: number },
  inset: Inset = {},
): Frame {
  const band = bandFor(viewport, inset);
  camera.aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
  camera.updateProjectionMatrix();

  const elevation = elevationFor(visibleFor(viewport, inset));
  const corners = cornersOf(extent);

  /**
   * Alternate the two.
   *
   * Solving the distance and then panning gets the size wrong, because the pan
   * moves the camera off the board's axis and a perspective projection is not
   * the same off-axis as on it. Measured over six viewports and four panels,
   * that cost up to 6% of the band — systematically, and worst wherever the
   * sheet was tall, which is the everyday case on a phone. Neither step is
   * expensive and each invalidates the other, so they run until both settle.
   */
  const target = new THREE.Vector3();
  const halfV = Math.tan((camera.fov * Math.PI) / 360);

  const place = (at: number): void => {
    camera.position
      .set(0, at * Math.sin(elevation), at * Math.cos(elevation))
      .add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  };

  let distance = Math.max(extent.width, extent.depth);

  for (let settle = 0; settle < 4; settle += 1) {
    for (let pass = 0; pass < 6; pass += 1) {
      place(distance);
      const seen = spanOf(camera, corners);
      const overflow = Math.max(
        seen.x / (band.width * MARGIN),
        seen.y / (band.height * MARGIN),
      );
      if (Math.abs(overflow - 1) < 0.002) break;
      distance *= overflow;
    }

    place(distance);
    const seen = spanOf(camera, corners);
    const offY = band.bottom + band.height / 2 - seen.midY;
    const offX = band.right - band.width / 2 - seen.midX;
    if (Math.abs(offX) < 1e-4 && Math.abs(offY) < 1e-4) break;

    // Along the camera's own up and right, because it is tilted over the board;
    // a camera that pans up makes the world appear to move down, hence the
    // negatives. Signed the other way first, which put the board underneath the
    // sheet and left the page looking like nothing had rendered at all.
    const perNdcY = distance * halfV;
    target.add(
      new THREE.Vector3()
        .setFromMatrixColumn(camera.matrixWorld, 1)
        .multiplyScalar(-offY * perNdcY)
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
          -offX * perNdcY * camera.aspect,
        ),
    );
    place(distance);
  }

  return { distance, elevation, target, band };
}
