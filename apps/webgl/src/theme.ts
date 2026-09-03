/**
 * The colours, in one place, for a screen that is half DOM and half WebGL.
 *
 * The mini app's palette is measured rather than chosen: its comment records
 * that the first snake/arrow/win set ran at 3.0–4.5:1 against the surface it
 * sat on, below the 4.5:1 small text needs, in both schemes at once — which is
 * what happens when one palette is used for light and dark. Those measured
 * values are the ones here, so the two boards do not disagree about what a
 * snake looks like.
 *
 * Numbers, not strings, because three.js wants numbers; `css()` hands the same
 * value to a stylesheet. One source, two consumers — the alternative is a hex
 * literal in a stylesheet and the same hex literal in a material, and those
 * drift the first time one of them is adjusted.
 */

/**
 * One palette, and the reason there is only one.
 *
 * There used to be two, and the light one was a second design nobody had ever
 * looked at. It produced the same defect on pass after pass: a colour measured
 * against one ground carried onto another. The winning square filled with a
 * value measured for text. The border drawn in a hairline colour. The numbers
 * left violet when the paper went away. And then, in light, arrows of pale wood
 * on pale beige — the same value, so they simply vanished. Four of one kind.
 *
 * The board now hangs in the vacuum, and **a light vacuum is a contradiction**.
 * Keeping a scheme that the composition cannot be true in was carrying a
 * generator of that defect for no one's benefit, so it is gone. If a light
 * variant is ever wanted it is a design, not a second column of hex.
 */
export interface Palette {

  /**
   * Behind the board, or `null` to let the page show through.
   *
   * `null` is not "no colour": it makes the canvas transparent, so whatever the
   * stylesheet puts on the page is the ground the board stands on. That is how
   * the light theme carries the app's own watercolour paper rather than a flat
   * cream rectangle painted over it.
   */
  readonly background: number | null;
  /** The board itself: painted ground, not a coloured tile. */
  readonly cell: number;
  /**
   * The ink of the border: its rules and its diamonds.
   *
   * Its own value, not the hairline colour it started as. That first value was
   * picked to separate two cells at one pixel, and used to draw a motif it came
   * out invisible against the paper in light mode — the same mistake as filling
   * a square with a colour measured for text. A line and a mark want different
   * contrast against the same ground.
   */
  readonly border: number;
  /**
   * The number at a knot.
   *
   * Measured against whatever the field is *now*, which is the point: this was
   * a violet chosen against paper, and when the board became a web hung in the
   * vacuum the numbers went to near-black on black. The third time a palette
   * entry has been carried onto a ground it was not measured for.
   */
  readonly label: string;
  /** The silk. Light on the void, dark on the table. */
  readonly thread: number;
  /**
   * The inlay marking a square a snake begins at.
   *
   * A *mark*, not a fill. The published board tints no square at all — its
   * `board-light.webp` is snakes and arrows on bare ground, and the mini app's
   * stylesheet only colours a cell in the fallback it draws when that painting
   * has not loaded. Filling seventy-two squares with saturated red and green
   * imported that fallback as if it were the board, and it is the single thing
   * that made this read as a toy rather than as the painted cloth it is.
   */
  readonly snake: number;
  /** The inlay marking a square an arrow begins at. */
  readonly arrow: number;
  /** Cosmic Consciousness. */
  readonly win: number;
  /** The player. */
  readonly piece: number;
  /** The ring under the player. */
  readonly halo: number;
  /**
   * The arrow's shaft, head and fletching.
   *
   * These were three module constants shared by both schemes, on the same
   * reasoning that keeps the snakes shared — *a python is not a different
   * colour at night.* That reasoning is right about a creature and wrong about
   * this, and the proof is not an argument: with one shaft light enough to read
   * on the void, the arrows on the paper board **disappeared completely**, and
   * with one dark enough for paper they were the muddy sand that made the void
   * board unreadable. Thirty snakes repainted from two swatches becomes two
   * creatures; one arrow given two shafts is still one arrow, drawn in the wood
   * you can actually see against the ground it is lying on.
   *
   * The snakes stay shared. They are dark on both grounds already, and their
   * variety is the thing the shared-material rule exists to protect.
   */
  readonly arrowWood: number;
  readonly arrowSteel: number;
  readonly arrowFeather: number;
  /** Ambient light strength. */
  readonly ambient: number;
  /** Key light strength. */
  readonly key: number;
  /** How strongly the room environment lights the materials. */
  readonly envIntensity: number;
  /** Film exposure. Tone mapping is ACES; this is the stop. */
  readonly exposure: number;
  /** Whether the board hangs in space or sits on a table. */
  readonly stars: boolean;
}

/** The void. */
export const SPACE: Palette = {
  // t27.ai's own `--bg`. In space there is nothing behind the stars.
  background: 0x000000,
  cell: 0xcdc4ab,
  border: 0x6b6047,
  // Pale, not violet: on the void a number has to carry itself.
  label: '#ffffff',
  thread: 0xffffff,
  snake: 0x8c3a2a,
  arrow: 0x35624a,
  win: 0xb8912f,
  piece: 0xff5cf7,
  halo: 0x201b12,
  // Bone, bright steel, near-white fletching. On the void the arrow is the pale
  // thing and the snake is the dark one, which is the whole distinction at a
  // glance.
  arrowWood: 0xe9e3d6,
  arrowSteel: 0xe4e9ee,
  arrowFeather: 0xf7f5f0,
  ambient: 0.28,
  key: 1.15,
  envIntensity: 0.42,
  exposure: 0.92,
  stars: true,
};

/**
 * The table.
 *
 * The board on paper, under a lamp, which is what the published painting is: a
 * cream field with the plans inked on it. The void's own values cannot simply
 * be inverted — the comments above say why twice. `label` was a violet measured
 * against paper and went to near-black on black; `border` was a hairline colour
 * used to draw a motif and came out invisible against the paper. Each entry
 * here is measured against *this* ground.
 *
 * `stars: false`, because a starfield over a lit table is the void showing
 * through the tablecloth.
 */
export const PAPER: Palette = {
  // The page, not a colour. See `background` on `Palette`.
  background: null,
  // Paper, not parchment. `0xe8e0cd` was a cream that read as grubby grey once
  // the room light hit it, and "the beige looks crude" was the first thing its
  // owner said about this board in either scheme. Lifted to a warm white, which
  // is what an actual page under a lamp is; `border` stays where it was, so the
  // ink on that page got darker relative to it rather than lighter.
  cell: 0xf5f2ea,
  border: 0x7a6c4e,
  // Dark, not pale: on paper a number has to carry itself the other way.
  label: '#241f18',
  // The silk, dark on the table - the comment on `thread` above says exactly
  // this: light on the void, dark here.
  thread: 0x3f3a30,
  snake: 0x9c3722,
  arrow: 0x2c5c42,
  win: 0x9a7000,
  piece: 0xc41fa8,
  halo: 0xe6e1d5,
  // Blued steel, not wood, and that is a measurement rather than a taste.
  //
  // On the page the ground is the pale thing, so the arrow must be dark — and
  // every snake is dark too, so the two collapse into each other. A search over
  // the whole colour cube says the best any colour can do here is 2.42:1
  // against the nearest snake while still clearing the paper at 3:1, and it
  // reaches that only as hot pink. **The lightness split that works on the void
  // is not available on paper at all.** Every warm dark shaft — walnut, ochre,
  // burnt umber — lands inside the snakes' own family at ΔE 6-22, because the
  // snakes ARE the warm dark colours.
  //
  // So the arrow leaves the family instead. Blued steel is a real arrow finish,
  // it is the one cool dark on the board, and it clears every snake by ΔE 24
  // where walnut managed 6.7. The board keeps its warmth; the thing that must
  // not be mistaken for a snake stops being the same colour as one.
  arrowWood: 0x25314f,
  arrowSteel: 0x445470,
  arrowFeather: 0x303c52,
  // Brighter room, softer key: a lit table has fill from every side, so the
  // shadow that models a tube on the void would read as grime here.
  ambient: 0.62,
  key: 0.85,
  envIntensity: 0.55,
  exposure: 1.0,
  stars: false,
};

/**
 * What the snakes are made of.
 *
 * The published painting carries several different snakes — a dark olive
 * python, a red-and-black banded one, a tan viper — and drawing all thirty in
 * one flat colour is most of why they read as identical rubber tubes. These are
 * naturalistic skins, assigned by position so the board is the same board every
 * time it loads.
 */
export const SNAKE_SKINS: readonly number[] = [
  0x4c5240, // olive python
  0x7d3a2c, // madder red
  0x54452c, // tan viper, darkened out of the shaft's band
  0x2f3a35, // near-black green
  0x5f4c31, // sand, darkened out of the shaft's band
  0x5a4038, // dark brown
];

/**
 * The arrow furniture used to live here, as `ARROW_WOOD`, `ARROW_STEEL` and
 * `ARROW_FEATHER`, shared by both schemes. It is on `Palette` now, and the
 * comment there says why one shaft could not serve two grounds.
 *
 * The old shaft was `0x9a7648`, and it was the board's worst defect rather than
 * a matter of taste: **four of the nine colours sat in one sandy band** — that
 * shaft, the tan viper, the sand and the dark brown — so an arrow and a snake
 * were the same colour at a glance. That is the single distinction the whole
 * game rests on. One carries you up, the other drops you, and the board could
 * not say which without being read edge by edge.
 *
 * The fix is a LIGHTNESS split rather than a hue one, so the naturalism above
 * survives: on each ground the arrow sits at the opposite end of the scale from
 * every snake, and hue may then repeat freely — a brown snake under a bone
 * arrow is unmistakable, and so is a walnut arrow under a pale one.
 * `a-snake-must-not-look-like-an-arrow.test.ts` holds the margin, checks BOTH
 * palettes against their own ground, and fails on the values that shipped.
 */

/** `#rrggbb`, for the places that take a string. */
export const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

/**
 * Which scheme to draw in.
 *
 * Takes the match rather than asking `matchMedia` itself, so the caller owns
 * the subscription and this stays testable.
 */

