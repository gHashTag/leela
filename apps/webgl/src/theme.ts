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

  /** Behind the board. */
  readonly background: number;
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
  ambient: 0.28,
  key: 1.15,
  envIntensity: 0.42,
  exposure: 0.92,
  stars: true,
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
  0x6d5c3c, // tan viper
  0x2f3a35, // near-black green
  0x8a6f4a, // sand
  0x5a4038, // dark brown
];

/** Arrow furniture: a wooden shaft, a steel head, a pale feather. */
export const ARROW_WOOD = 0x9a7648;
export const ARROW_STEEL = 0xc2c7cb;
export const ARROW_FEATHER = 0xded3bd;

/** `#rrggbb`, for the places that take a string. */
export const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

/**
 * Which scheme to draw in.
 *
 * Takes the match rather than asking `matchMedia` itself, so the caller owns
 * the subscription and this stays testable.
 */

