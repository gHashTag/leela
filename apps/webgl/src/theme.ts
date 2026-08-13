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

export type Scheme = 'light' | 'dark';

export interface Palette {
  /** Behind the board. */
  readonly background: number;
  /** The board itself: painted ground, not a coloured tile. */
  readonly cell: number;
  /** The line between plans. */
  readonly edge: number;
  /** The number painted on a plan. */
  readonly label: string;
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
}

/**
 * Light and dark, sharing the mini app's three measured hues.
 *
 * The board's own surfaces are not shared: a face that reads as paper on white
 * reads as a lamp on black, and the two were tried side by side.
 */
/**
 * Pigments, not UI colours.
 *
 * The board is a painted cloth from a tradition with a known palette — ochre
 * ground, madder red, indigo, verdigris, lamp black — and the previous set was
 * a phone app's accent colours borrowed wholesale. Two different things were
 * being asked of one number: the mini app's `--snake` is measured for *small
 * text on a surface*, and using it to paint a surface is a different
 * measurement of the same hue.
 */
export const PALETTES: Record<Scheme, Palette> = {
  light: {
    // A shade the board can sit *on*. The first light background was within a
    // few percent of the paper, so the two merged and the board had no edge —
    // the thing that had been built as an object read as a texture on the page.
    background: 0xcfc8b8,
    // Aged paper, warm rather than white. A pure-white board under image-based
    // lighting clips to a flat sheet with no form in it.
    cell: 0xf0e9d8,
    edge: 0xbdb29a,
    label: '#7b3d86',
    snake: 0x8c3a2a,
    arrow: 0x35624a,
    win: 0xc9a13f,
    piece: 0xff06f4,
    halo: 0x2a2418,
    ambient: 0.5,
    key: 1.6,
    envIntensity: 1,
    exposure: 1.05,
  },
  /**
   * Dark is a dark *room*, not a dark board.
   *
   * The first attempt dyed the board itself brown, and it came out as
   * cardboard: the numbers lost their contrast and the whole thing looked like
   * a print-out. A painted cloth does not change colour when the lights go
   * down — you change how much light falls on it. So the ground stays paper,
   * one stop dimmer, and it is the surround that goes dark. The board then
   * reads as a lit object on a dark table, which is what it is.
   */
  dark: {
    background: 0x121114,
    cell: 0xcdc4ab,
    edge: 0x8d8570,
    label: '#7b3d86',
    snake: 0x8c3a2a,
    arrow: 0x35624a,
    win: 0xb8912f,
    piece: 0xff5cf7,
    halo: 0x201b12,
    ambient: 0.28,
    key: 1.15,
    envIntensity: 0.42,
    exposure: 0.92,
  },
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
export const schemeFor = (prefersDark: boolean): Scheme => (prefersDark ? 'dark' : 'light');

export const paletteFor = (scheme: Scheme): Palette => PALETTES[scheme];
