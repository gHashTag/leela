import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ARROWS, SNAKES, WIN_LOKA } from '@leela/engine';

import { gridFor, paintLabels, tileFor } from './atlas';
import { DEFAULT_DEITY, type Deity } from './deities';
import { animationClock, frames, type Clock, type Frames } from './frames';
import { CELL, boardExtent, planPosition, plans } from './layout';
import {
  ARROW_FEATHER,
  ARROW_STEEL,
  ARROW_WOOD,
  SNAKE_SKINS,
  paletteFor,
  type Scheme,
} from './theme';
import { arrowProfile, snakeProfile, wiggle, type Profile } from './tube';

/**
 * The board, drawn.
 *
 * Everything positional comes from `layout`, which is tested; this file only
 * turns those numbers into meshes. Keeping the split means a board that looks
 * wrong is either a layout bug (catchable by a test) or a material bug (only
 * catchable by eye), and you always know which.
 *
 * three.js 0.160: `outputColorSpace` replaced `outputEncoding`, and lights are
 * physically scaled by default, hence the explicit intensities.
 *
 * When it is drawn is not here either — see `frames`, which exists because the
 * answer used to be *never*.
 */

/**
 * The box the framing has to fit: the board, and the air the arcs travel
 * through. Fitting the flat board alone crops the tallest jump.
 */
const ARC_CEILING = 1.9;
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

/** Bounds on how far over the board the camera stands. See `resize`. */
const ELEVATION_MAX = (74 * Math.PI) / 180;
const ELEVATION_MIN = (50 * Math.PI) / 180;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How many samples a snake's winding path is built from. */
const SNAKE_POINTS = 14;
/**
 * How thick a snake and an arrow are.
 *
 * Set by looking, at the distance the board is actually framed to. The first
 * pass used 0.075 and 0.028, which on a phone came out as a thread — the
 * arrowheads and the fletching were there and invisible, which is the same as
 * not being there.
 */
const SNAKE_GIRTH = 0.1;
/**
 * A shaft is slender.
 *
 * At the snake's girth an arrow reads as a branch, and with thirty of them the
 * board disappears under kindling. Thin enough to be an arrow, with the head
 * carrying the weight — which is how the published painting draws them.
 */
const ARROW_SHAFT = 0.035;

const LABEL_TILE = 128;
/** How much of a cell the number covers. */
const LABEL_SPAN = 0.86;
/** Clear of the cell's top face, which sits at 0.06. */
const LABEL_Y = 0.063;

export interface Board {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly piece: THREE.Object3D;
  /** Highlights a plan, and the jump it is an end of; null clears. */
  focus(plan: number | null): void;
  /**
   * @param inset pixels of the canvas the sheet covers, from the bottom and
   *        from the right. The board is framed in what is left, because a board
   *        centred behind a panel is a board with rows hidden — which is what
   *        shipped. Both edges, because the sheet is a bottom sheet on a phone
   *        and a side panel on a desktop, and framing the desktop layout as
   *        though the panel were still along the bottom left the board in a
   *        strip across the top with half the window empty beside it.
   */
  resize(width: number, height: number, inset?: { bottom?: number; right?: number }): void;
  /** Draws one frame. Nothing renders unless someone asks. */
  draw(): void;
  /** Which plan is under this point on the canvas, if any. */
  planAt(x: number, y: number): number | null;
  setScheme(scheme: Scheme): void;
  /** Who the player is playing as. Rebuilds the token in place. */
  setDeity(deity: Deity): void;
  dispose(): void;
}

/** Every jump on the board, as directed edges. */
const jumps = (): ReadonlyArray<{ from: number; to: number; kind: 'snake' | 'arrow' }> => [
  ...Object.entries(SNAKES).map(([from, to]) => ({
    from: Number(from),
    to,
    kind: 'snake' as const,
  })),
  ...Object.entries(ARROWS).map(([from, to]) => ({
    from: Number(from),
    to,
    kind: 'arrow' as const,
  })),
];

/**
 * The path a jump travels.
 *
 * An arrow flies, so it arcs. A snake lies on the board, so it does not — it
 * winds. Two different curves, because drawing them the same is what made the
 * board a bowl of identical hoses.
 */
const jumpCurve = (from: number, to: number, kind: 'snake' | 'arrow'): THREE.CatmullRomCurve3 => {
  const a = planPosition(from);
  const b = planPosition(to);
  const run = Math.hypot(b.x - a.x, b.z - a.z);

  if (kind === 'arrow') {
    // Low enough to read the squares underneath, high enough to tell two
    // crossing arcs apart. The board carries thirty of these.
    const lift = Math.max(0.55, run * 0.22);
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(a.x, 0.1, a.z),
      new THREE.Vector3((a.x + b.x) / 2, lift, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, 0.1, b.z),
    ]);
  }

  // A snake, lying across the squares it connects: a low rise so it is not
  // buried in the board, and bends across the direction of travel.
  const along = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const across = new THREE.Vector3(-along.z, 0, along.x);
  const amplitude = Math.min(0.9, run * 0.12);

  const points: THREE.Vector3[] = [];
  for (let step = 0; step <= SNAKE_POINTS; step += 1) {
    const t = step / SNAKE_POINTS;
    const side = across.clone().multiplyScalar(wiggle(t, amplitude));
    points.push(
      new THREE.Vector3(
        a.x + (b.x - a.x) * t + side.x,
        0.16 + Math.sin(t * Math.PI) * 0.1,
        a.z + (b.z - a.z) * t + side.z,
      ),
    );
  }
  return new THREE.CatmullRomCurve3(points);
};

/**
 * A tube of varying radius along a curve.
 *
 * three.js has no such thing, and the profiles that decide the shape live in
 * `tube` where they can be tested. This is the sweep: a ring of vertices at
 * each sample, oriented by the curve's own frames so the body does not twist.
 */
const taperedTube = (
  curve: THREE.Curve<THREE.Vector3>,
  profile: Profile,
  along = 48,
  around = 10,
): THREE.BufferGeometry => {
  const frames = curve.computeFrenetFrames(along, false);
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= along; i += 1) {
    const t = i / along;
    const centre = curve.getPointAt(t);
    const radius = profile(t);
    const N = frames.normals[i] as THREE.Vector3;
    const B = frames.binormals[i] as THREE.Vector3;

    for (let j = 0; j <= around; j += 1) {
      const angle = (j / around) * Math.PI * 2;
      const out = N.clone()
        .multiplyScalar(-Math.cos(angle))
        .add(B.clone().multiplyScalar(Math.sin(angle)));
      position.push(centre.x + out.x * radius, centre.y + out.y * radius, centre.z + out.z * radius);
      normal.push(out.x, out.y, out.z);
    }
  }

  for (let i = 1; i <= along; i += 1) {
    for (let j = 1; j <= around; j += 1) {
      const a = (around + 1) * (i - 1) + (j - 1);
      const b = (around + 1) * i + (j - 1);
      const c = (around + 1) * i + j;
      const d = (around + 1) * (i - 1) + j;
      index.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
};

/**
 * The numbers, as one mesh.
 *
 * Seventy-two quads sharing one texture and one material. See `atlas` for the
 * arithmetic and for why the flip between canvas space and texture space is the
 * part that gets tested.
 */
const labelMesh = (
  ordered: readonly number[],
  texture: THREE.Texture,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => {
  const grid = gridFor(ordered.length);
  const half = (CELL * LABEL_SPAN) / 2;

  const position = new Float32Array(ordered.length * 4 * 3);
  const uv = new Float32Array(ordered.length * 4 * 2);
  const index: number[] = [];

  for (const [at, plan] of ordered.entries()) {
    const { x, z } = planPosition(plan);
    const tile = tileFor(at, grid);

    // Wound counter-clockwise seen from above, so the face points at the
    // camera; laid out so the digits read up-screen, which is -Z.
    const corners: ReadonlyArray<readonly [number, number, number, number]> = [
      [x - half, z + half, tile.u0, tile.v0],
      [x + half, z + half, tile.u1, tile.v0],
      [x + half, z - half, tile.u1, tile.v1],
      [x - half, z - half, tile.u0, tile.v1],
    ];

    for (const [corner, [cx, cz, u, v]] of corners.entries()) {
      const vertex = at * 4 + corner;
      position[vertex * 3] = cx;
      position[vertex * 3 + 1] = LABEL_Y;
      position[vertex * 3 + 2] = cz;
      uv[vertex * 2] = u;
      uv[vertex * 2 + 1] = v;
    }

    const base = at * 4;
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    // Basic rather than standard: a number is signage. It should read the same
    // in the shadow of an arc as it does in the light.
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
};

/**
 * Somewhere to paint the numbers.
 *
 * Injected rather than taken from `document`, and that is not fussiness. This
 * board is meant to reach `apps/mobile`, which is Expo — three.js runs there
 * against a native GL context through `expo-gl`, and there is no `document` in
 * it at all. One `document.createElement('canvas')` in this file is the
 * difference between porting the scene and rewriting it, so the DOM is a
 * default rather than a dependency. The renderer's own canvas arrives the same
 * way, from the caller.
 */
export type Surface = (width: number, height: number) => LabelCanvas;

/** What painting the atlas needs of a canvas, and nothing else. */
export interface LabelCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

const domSurface: Surface = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const createBoard = (
  canvas: HTMLCanvasElement,
  clock: Clock = animationClock(),
  surface: Surface = domSurface,
): Board => {
  const ordered = plans();
  let palette = paletteFor('light');

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /**
   * Filmic response, and light that comes from somewhere.
   *
   * Two lamps and no environment is why every surface read as flat plastic: a
   * `MeshStandardMaterial` is a physically-based material and, given nothing to
   * reflect, it has nothing to be made of. `RoomEnvironment` is generated in
   * memory — no asset to ship — and pre-filtered into a cube map the materials
   * sample, which is what puts a gradient across a curved snake instead of one
   * flat highlight.
   *
   * ACES rolls the highlights off instead of clipping them to white. Without
   * it, the gold on 68 and the pale token both burn out to the same paper.
   */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = room.texture;

  const { width, depth } = boardExtent();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  const ambient = new THREE.AmbientLight(0xffffff, palette.ambient);
  const key = new THREE.DirectionalLight(0xffffff, palette.key);
  key.position.set(4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(ambient, key);

  /**
   * One ground for all seventy-two squares, and marks on top of it.
   *
   * The published board — `apps/miniapp/src/board-light.webp`, which is the
   * painting the phone app actually ships — tints no square at all. It is
   * snakes and arrows on bare ground, with the Flower of Life on 68 and nothing
   * else. The mini app's stylesheet colours a cell only under
   * `.board:not(.painted)`, the fallback drawn when that image has not loaded.
   *
   * This board had imported the fallback as though it were the design, so
   * roughly a third of the squares were solid red or solid green. That is what
   * made it read as a children's boardgame: the strongest colour on screen was
   * carrying the least meaning.
   *
   * Now every square is the same painted ground, and where a jump *starts* gets
   * a thin inlay around its edge — the same information, at the weight it
   * deserves.
   */
  const groundMaterial = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.0 });
  const inlays = {
    snake: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }),
    arrow: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }),
    win: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.75 }),
  };

  const cells = new THREE.Group();
  const cellGeometry = new THREE.BoxGeometry(CELL, 0.12, CELL);
  const inlayGeometry = new THREE.RingGeometry(CELL * 0.4, CELL * 0.455, 4, 1, Math.PI / 4);

  for (const plan of ordered) {
    const mesh = new THREE.Mesh(cellGeometry, groundMaterial);
    const { x, z } = planPosition(plan);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    mesh.userData.plan = plan;
    cells.add(mesh);

    const kind = plan === WIN_LOKA ? 'win' : plan in SNAKES ? 'snake' : plan in ARROWS ? 'arrow' : null;
    if (kind) {
      // A square ring, rotated to sit square with the cell rather than as a
      // diamond — `RingGeometry` with four segments starts a corner at zero.
      const inlay = new THREE.Mesh(inlayGeometry, inlays[kind]);
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(x, 0.062, z);
      // The same square as the cell beneath it, so tapping the mark selects
      // the plan rather than falling through to nothing.
      inlay.userData.plan = plan;
      cells.add(inlay);
    }
  }
  scene.add(cells);

  // --- the numbers ---------------------------------------------------------

  const grid = gridFor(ordered.length);
  const labelCanvas = surface(grid.columns * LABEL_TILE, grid.rows * LABEL_TILE);
  const labelPainter = labelCanvas.getContext('2d');

  // `CanvasTexture` is typed to the DOM's two canvases, and `Surface` is
  // deliberately looser than either so an Expo build can hand over whatever
  // `expo-gl` gives it. What three.js does with this is store it and pass it to
  // `texImage2D`, which accepts any real canvas — so the cast is about the type
  // being narrower than the runtime, not about the runtime being unchecked.
  const labelTexture = new THREE.CanvasTexture(labelCanvas as unknown as HTMLCanvasElement);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  labelTexture.anisotropy = 4;

  const repaintLabels = (): void => {
    if (!labelPainter) return;
    paintLabels(
      labelPainter,
      ordered.map((plan) => String(plan)),
      LABEL_TILE,
      { colour: palette.label },
    );
    labelTexture.needsUpdate = true;
  };

  const labels = labelMesh(ordered, labelTexture);
  scene.add(labels);

  // --- the jumps -----------------------------------------------------------

  // Near-black, and shared: eyes, the flute's finger holes. Anything that has
  // to stay dark whatever colour the thing around it is.
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.4 });

  const links = new THREE.Group();
  const linkOf = new Map<number, THREE.MeshStandardMaterial[]>();

  /**
   * A material per jump, not per kind.
   *
   * Thirty materials where two would do, and the reason is `focus`: the jumps
   * touching the square you are standing on are lit, and lighting one of them
   * means changing something only it owns. The first version shared two
   * materials and highlighted by scaling the arc's group instead — which scaled
   * it about the world origin, because the arc's vertices are already in world
   * coordinates. The highlighted arrow left the board entirely.
   */
  const linkMaterials: THREE.MeshStandardMaterial[] = [];

  const remember = (plan: number, material: THREE.MeshStandardMaterial): void => {
    const held = linkOf.get(plan) ?? [];
    held.push(material);
    linkOf.set(plan, held);
  };

  /** Points a mesh's local +Y along a direction. */
  const aim = (mesh: THREE.Object3D, direction: THREE.Vector3): void => {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  };

  for (const [at, { from, to, kind }] of jumps().entries()) {
    const curve = jumpCurve(from, to, kind);
    const group = new THREE.Group();

    /**
     * A material per part, cloned per jump.
     *
     * Cloned because `focus` lights the jumps touching the square you stand on,
     * and lighting one means changing something only it owns. Per *part*
     * because an arrow is not one substance: the published painting shows a
     * wooden shaft, a steel head and a feather, and drawing all three in one
     * flat green is why they read as garden hose with a cone on the end.
     *
     * Built after construction rather than in the literal: `audit-unread` reads
     * source with a regex, and a multi-line object literal ending in `});` is
     * indistinguishable to it from an interface body — so `roughness` was
     * reported as a field written and never read.
     */
    const partMaterial = (colour: number, roughness: number, metalness: number) => {
      const made = new THREE.MeshStandardMaterial({ emissiveIntensity: 0 });
      made.color.setHex(colour);
      made.roughness = roughness;
      made.metalness = metalness;
      made.envMapIntensity = palette.envIntensity;
      linkMaterials.push(made);
      remember(from, made);
      remember(to, made);
      return made;
    };

    const material =
      kind === 'snake'
        ? // Assigned by position, so the board is the same board every load.
          partMaterial(SNAKE_SKINS[at % SNAKE_SKINS.length] as number, 0.42, 0.08)
        : partMaterial(ARROW_WOOD, 0.72, 0.05);

    const start = curve.getPointAt(0);
    const end = curve.getPointAt(1);
    const intoStart = start.clone().sub(curve.getPointAt(0.04)).normalize();
    const intoEnd = end.clone().sub(curve.getPointAt(0.96)).normalize();

    if (kind === 'snake') {
      // Thick behind the head at `from` — the square you land on — tapering to
      // the tail at `to`, which is where it puts you down. The taper is the
      // rule, drawn.
      group.add(new THREE.Mesh(taperedTube(curve, snakeProfile(SNAKE_GIRTH)), material));

      const head = new THREE.Mesh(new THREE.SphereGeometry(SNAKE_GIRTH * 1.5, 16, 12), material);
      head.scale.set(1, 0.72, 1.35);
      head.position.copy(start);
      aim(head, intoStart);
      head.castShadow = true;
      group.add(head);

      // Two eyes, so the head end is unmistakable at a glance and at a
      // thumbnail. Their own material: a snake the colour of its own eyes is a
      // snake with no eyes.
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(SNAKE_GIRTH * 0.34, 8, 6), eyeMaterial);
        eye.position
          .copy(start)
          .add(intoStart.clone().multiplyScalar(SNAKE_GIRTH * 0.9))
          .add(new THREE.Vector3(-intoStart.z, 0, intoStart.x).multiplyScalar(side * SNAKE_GIRTH * 0.62))
          .add(new THREE.Vector3(0, SNAKE_GIRTH * 0.5, 0));
        group.add(eye);
      }
    } else {
      // A shaft, a head at the square it carries you to, and fletching at the
      // one it leaves. Three parts, because that is what makes it read as an
      // arrow rather than as a hose with a cone on it.
      group.add(new THREE.Mesh(taperedTube(curve, arrowProfile(ARROW_SHAFT), 40, 8), material));

      const steel = partMaterial(ARROW_STEEL, 0.26, 0.92);
      const head = new THREE.Mesh(new THREE.ConeGeometry(ARROW_SHAFT * 4.2, 0.3, 14), steel);
      head.position.copy(end);
      aim(head, intoEnd.clone().negate());
      head.castShadow = true;
      group.add(head);

      const feather = partMaterial(ARROW_FEATHER, 0.95, 0.0);
      for (const turn of [0, 1, 2]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.12), feather);
        fin.position.copy(start).add(intoStart.clone().multiplyScalar(-0.06));
        aim(fin, intoStart.clone().negate());
        fin.rotateY((turn * Math.PI * 2) / 3);
        fin.translateX(0.05);
        group.add(fin);
      }
    }

    links.add(group);
  }
  scene.add(links);

  // --- the player ----------------------------------------------------------

  const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25 });
  const accentMaterial = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.6 });

  const piece = new THREE.Group();
  /** Everything above the seat: replaced whenever the player changes deity. */
  const emblemHolder = new THREE.Group();
  emblemHolder.position.y = 0.16;

  /** The lean. Inside its own group so the billboard turn stays about Y. */
  const emblemLean = new THREE.Group();
  emblemLean.rotation.x = 0.62;
  // Beside the figure rather than on top of it: an attribute is held.
  emblemLean.position.set(0.3, 0.12, 0);
  emblemLean.scale.setScalar(0.8);
  emblemHolder.add(emblemLean);

  /**
   * The figure.
   *
   * Held to a silhouette rather than a likeness, and that is a size decision
   * before it is a taste one: the board is framed so a square is about thirty
   * pixels across on a phone, and the first token — three rings of lotus petals
   * with a modelled attribute above them — resolved at that size into a smear
   * of confetti. What survives thirty pixels is a shape, a colour and a halo.
   *
   * So: a plinth, a tapering body, a head, and the prabhamandala behind it in
   * the deity's second colour. The attribute is still there, held at the side,
   * for a player who pinches in.
   */
  const seat = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.07, 20), bodyMaterial);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.24, 0.42, 16), bodyMaterial);
  trunk.position.y = 0.24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), bodyMaterial);
  head.position.y = 0.55;
  for (const part of [plinth, trunk, head]) {
    part.castShadow = true;
    seat.add(part);
  }

  // The halo, behind the head and turned to face the camera with the emblem.
  const halo3d = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 20), accentMaterial);
  halo3d.position.y = 0.55;
  halo3d.castShadow = true;

  seat.position.y = -0.16;
  emblemHolder.add(halo3d);
  piece.add(seat, emblemHolder);
  // Half again as large as a square is wide at the base. A token the size of
  // the number underneath it is a token nobody can see who they are playing as,
  // and who you are playing as is now the point.
  piece.scale.setScalar(1.5);
  piece.position.set(0, 0.3, 0);
  scene.add(piece);

  /**
   * The attribute the deity is known by, built from primitives.
   *
   * Emblems rather than figures. A recognisable object in brass is something
   * this can build honestly at the size of a board square; a face is not, and a
   * bad one would be worse than none.
   */
  const buildEmblem = (deity: Deity): THREE.Object3D => {
    const made = new THREE.Group();
    const add = (mesh: THREE.Mesh): THREE.Mesh => {
      mesh.castShadow = true;
      made.add(mesh);
      return mesh;
    };

    switch (deity.emblem) {
      case 'chakra': {
        const disc = add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 8, 24), accentMaterial));
        disc.rotation.x = Math.PI / 2.4;
        for (let spoke = 0; spoke < 6; spoke += 1) {
          const bar = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.02), accentMaterial));
          bar.rotation.set(Math.PI / 2.4, 0, 0);
          bar.rotateZ((spoke * Math.PI) / 6);
        }
        break;
      }
      case 'trishula': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), accentMaterial)).position.y = 0.05;
        for (const side of [-1, 0, 1]) {
          const prong = add(new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 8), accentMaterial));
          prong.position.set(side * 0.075, 0.28, 0);
          prong.rotation.z = -side * 0.22;
        }
        break;
      }
      case 'padma': {
        for (const [ring, [count, radius, tilt]] of [
          [8, 0.13, 0.9],
          [6, 0.07, 0.45],
        ].entries()) {
          for (let petal = 0; petal < (count as number); petal += 1) {
            const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), accentMaterial));
            leaf.scale.set(0.5, 0.3, 1);
            const angle = (petal / (count as number)) * Math.PI * 2 + ring * 0.35;
            leaf.position.set(
              Math.cos(angle) * (radius as number),
              0.06 + ring * 0.05,
              Math.sin(angle) * (radius as number),
            );
            leaf.rotation.y = -angle;
            leaf.rotation.x = -(tilt as number) * 0.4;
          }
        }
        break;
      }
      case 'bansuri': {
        const flute = add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.42, 10), accentMaterial));
        flute.rotation.set(0, 0.4, Math.PI / 2.6);
        flute.position.y = 0.12;
        for (let hole = 0; hole < 4; hole += 1) {
          const dot = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), eyeMaterial));
          dot.position.set(-0.09 + hole * 0.06, 0.145 + hole * 0.024, 0.026);
        }
        break;
      }
      case 'veena': {
        const gourd = add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), accentMaterial));
        gourd.position.set(-0.06, 0.06, 0);
        gourd.scale.set(1, 0.85, 1);
        const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.023, 0.36, 8), accentMaterial));
        neck.position.set(0.06, 0.17, 0);
        neck.rotation.z = -0.5;
        break;
      }
      case 'khanga': {
        const blade = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.012), accentMaterial));
        blade.position.y = 0.19;
        const tip = add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), accentMaterial));
        tip.position.y = 0.39;
        const guard = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), accentMaterial));
        guard.position.y = 0.03;
        break;
      }
      case 'vajra': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8), accentMaterial)).position.y = 0.14;
        for (const end of [0.05, 0.23]) {
          const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), accentMaterial));
          bulb.position.y = end;
          for (let prong = 0; prong < 4; prong += 1) {
            const spike = add(new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.1, 6), accentMaterial));
            const angle = (prong / 4) * Math.PI * 2;
            spike.position.set(
              Math.cos(angle) * 0.038,
              end + (end > 0.14 ? 0.06 : -0.06),
              Math.sin(angle) * 0.038,
            );
            spike.rotation.z = (end > 0.14 ? -1 : 1) * Math.cos(angle) * 0.3;
            spike.rotation.x = (end > 0.14 ? 1 : -1) * Math.sin(angle) * 0.3;
            if (end <= 0.14) spike.rotation.x += Math.PI;
          }
        }
        break;
      }
      case 'jvala': {
        for (const [at, [scale, lift, lean]] of [
          [1, 0.1, 0],
          [0.62, 0.26, 0.3],
          [0.4, 0.36, -0.35],
        ].entries()) {
          const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.09 * (scale as number), 0.26 * (scale as number), 8), accentMaterial));
          flame.position.set((lean as number) * 0.06, lift as number, at * 0.01);
          flame.rotation.z = -(lean as number) * 0.5;
        }
        break;
      }
    }
    return made;
  };

  let deity: Deity = DEFAULT_DEITY;

  const dressPiece = (): void => {
    bodyMaterial.color.setHex(deity.colour);
    accentMaterial.color.setHex(deity.accent);
    for (const old of [...emblemLean.children]) {
      emblemLean.remove(old);
      old.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    }
    emblemLean.add(buildEmblem(deity));
  };
  dressPiece();

  const haloMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.5, CELL * 0.58, 48), haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  scene.add(halo);

  // --- the theme -----------------------------------------------------------

  const applyPalette = (): void => {
    scene.background = new THREE.Color(palette.background);
    ambient.intensity = palette.ambient;
    key.intensity = palette.key;
    renderer.toneMappingExposure = palette.exposure;
    // `Scene.environmentIntensity` arrived in r163 and this is three 0.160, so
    // the strength is set per material. Every standard material in the scene,
    // gathered by walking it rather than by keeping a list beside the one that
    // already exists — a second list is a material that gets added and missed.
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = palette.envIntensity;
        }
      }
    });
    groundMaterial.color.setHex(palette.cell);
    inlays.snake.color.setHex(palette.snake);
    inlays.arrow.color.setHex(palette.arrow);
    inlays.win.color.setHex(palette.win);
    // Snakes and arrows keep their own materials across schemes: a python is
    // not a different colour at night, and the earlier version repainted every
    // one of them from two theme swatches, which is what made thirty distinct
    // creatures into two. Only the emissive is kept in step, because that is
    // what `focus` moves.
    for (const material of linkMaterials) material.emissive.setHex(material.color.getHex());
    // The token's colours belong to the deity, not to the scheme — the point of
    // choosing Durga is that the piece is Durga's red in either theme.
    haloMaterial.color.setHex(palette.halo);
    repaintLabels();
  };
  applyPalette();

  // Orbit rather than a locked camera: a board read at one angle hides the
  // arcs that cross it. Damped, and clamped so the camera cannot drop under
  // the board or spin to a view where the numbers read upside down.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;

  const clockFrames: Frames = frames(() => {
    const moving = controls.update();

    /**
     * Turn the emblem to face whoever is looking.
     *
     * The camera stands nearly overhead on a phone — that is what makes the
     * board fit — and a trishula modelled standing upright is seen end-on from
     * there. Every token looked like a coloured smudge. So the emblem is a
     * standee: it swings about its own axis to face the camera and leans back
     * far enough to be read from above, while the lotus seat underneath stays
     * put and keeps the token's footprint honest.
     */
    emblemHolder.rotation.y = Math.atan2(
      camera.position.x - piece.position.x,
      camera.position.z - piece.position.z,
    );

    renderer.render(scene, camera);
    return moving;
  }, clock);

  // The listener only asks for a frame. It must never draw one, and it must
  // never call `update` — see `frames`.
  controls.addEventListener('change', clockFrames.draw);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let lit: THREE.MeshStandardMaterial[] = [];

  return {
    scene,
    camera,
    renderer,
    piece,
    draw: clockFrames.draw,

    focus(plan) {
      for (const material of lit) material.emissiveIntensity = 0;
      lit = [];

      if (plan === null) {
        halo.visible = false;
        return;
      }

      const { x, z } = planPosition(plan);
      halo.position.set(x, 0.075, z);
      halo.visible = true;

      // The jumps this square is an end of, lit. On a board of thirty arcs,
      // "is there a snake here" should be answered by looking at one of them
      // rather than by tracing all of them.
      lit = linkOf.get(plan) ?? [];
      for (const material of lit) material.emissiveIntensity = 0.55;
    },

    planAt(x, y) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(cells.children, false);
      const plan = hit?.object.userData.plan;
      return typeof plan === 'number' ? plan : null;
    },

    setScheme(scheme) {
      palette = paletteFor(scheme);
      applyPalette();
      clockFrames.draw();
    },

    setDeity(next) {
      deity = next;
      dressPiece();
      clockFrames.draw();
    },

    resize(w, h, inset = {}) {
      const height = Math.max(1, h);
      const width2 = Math.max(1, w);
      // Never let the sheet claim the whole canvas: on a short window at the
      // full detent there would be no band left, and the board would be framed
      // against a zero-height strip.
      const visible = Math.max(height * 0.35, height - Math.max(0, inset.bottom ?? 0));
      const visibleW = Math.max(width2 * 0.35, width2 - Math.max(0, inset.right ?? 0));
      camera.aspect = width2 / height;
      camera.updateProjectionMatrix();

      // The band the board has to fit, in clip space. y = 1 is the top of the
      // canvas and the sheet eats upwards from the bottom; x = -1 is the left
      // edge and a side panel eats inwards from the right.
      const bandBottom = 1 - (2 * visible) / height;
      const bandHeight = 1 - bandBottom;
      const bandRight = (2 * visibleW) / width2 - 1;
      const bandWidth = bandRight + 1;

      /**
       * Fit by projecting the board, not by trusting trigonometry about it.
       *
       * The arithmetic version — fit `depth` to the vertical field of view —
       * is what was here, and it is wrong for the same reason it looks right:
       * the board is tilted away from the camera, so its depth on screen is
       * foreshortened by an amount that depends on the very distance being
       * solved for. It left the board at about half the size of the space it
       * had. Projecting the corners asks the camera what it can actually see,
       * and converges in three passes.
       */
      /**
       * How far above the board to stand, given the shape of the space.
       *
       * A fixed 55° is right for a laptop and wasteful on a phone. The board is
       * wider than it is deep, so on any portrait screen the width is what
       * binds the distance — and the flatter the camera, the less of the
       * leftover height the board's depth uses. Standing more nearly overhead
       * maps that depth onto the screen instead. Not all the way overhead: a
       * top-down board is a spreadsheet, and the arcs that make Leela legible
       * stop reading as arcs.
       */
      const elevation =
        ELEVATION_MAX - (ELEVATION_MAX - ELEVATION_MIN) * clamp01(visibleW / visible / 1.6);

      const place = (at: number): void => {
        camera.position.set(0, at * Math.sin(elevation), at * Math.cos(elevation));
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
      };

      let distance = Math.max(width, depth);
      let span = { x: 0, y: 0, midX: 0, midY: 0 };

      for (let pass = 0; pass < 4; pass += 1) {
        place(distance);

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const corner of CORNERS) {
          const point = new THREE.Vector3(
            (corner[0] * width) / 2,
            corner[1] * ARC_CEILING,
            (corner[2] * depth) / 2,
          ).project(camera);
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }

        span = {
          x: maxX - minX,
          y: maxY - minY,
          midX: (maxX + minX) / 2,
          midY: (maxY + minY) / 2,
        };
        // 0.94 rather than 1: a board touching the edge of its band reads as
        // cropped even when every square is on screen.
        const overflow = Math.max(span.x / (bandWidth * 0.94), span.y / (bandHeight * 0.94));
        if (Math.abs(overflow - 1) < 0.01) break;
        distance *= overflow;
      }

      place(distance);

      // Slide the board into the middle of the band, on both axes. The pan is
      // along the camera's own up and right, because the camera is tilted over
      // the board; a camera that pans up makes the world appear to move down,
      // hence the negatives. Signed the other way first, which put the board
      // underneath the sheet and left the page looking like nothing rendered.
      const halfV = Math.tan((camera.fov * Math.PI) / 360);
      const perNdcY = distance * halfV;
      const pan = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrixWorld, 1)
        .multiplyScalar(-(bandBottom + bandHeight / 2 - span.midY) * perNdcY)
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
          -(bandRight - bandWidth / 2 - span.midX) * perNdcY * camera.aspect,
        );
      camera.position.add(pan);
      controls.target.add(pan);
      camera.lookAt(controls.target);

      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.6;

      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, height, false);
      clockFrames.draw();
    },

    dispose() {
      clockFrames.stop();
      room.dispose();
      pmrem.dispose();
      controls.removeEventListener('change', clockFrames.draw);
      controls.dispose();
      labelTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
    },
  };
};
