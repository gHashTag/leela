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
  /** A plain plan's face. */
  readonly cell: number;
  /** The line between plans. */
  readonly edge: number;
  /** The number painted on a plan. */
  readonly label: string;
  /** A plan a snake starts from. */
  readonly snake: number;
  /** A plan an arrow starts from. */
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
}

/**
 * Light and dark, sharing the mini app's three measured hues.
 *
 * The board's own surfaces are not shared: a face that reads as paper on white
 * reads as a lamp on black, and the two were tried side by side.
 */
export const PALETTES: Record<Scheme, Palette> = {
  light: {
    background: 0xf4f6f8,
    cell: 0xfbfcfd,
    edge: 0xd4dade,
    label: '#33393d',
    snake: 0xa3301c,
    arrow: 0x1f6b39,
    // Not the mini app's `--win`.
    //
    // That value is #7a5a12, and it is measured — for *text and a border*, at
    // 4.5:1 against the surface behind it. Filling a whole square with it makes
    // the end of the game the darkest thing on a light board, which is the
    // opposite of what it means. A surface colour and a text colour are
    // different measurements of the same hue, and this is the surface.
    win: 0xe8c451,
    piece: 0xff06f4,
    halo: 0x1c1c1c,
    ambient: 1.15,
    key: 2.1,
  },
  dark: {
    background: 0x14171a,
    cell: 0x272c31,
    edge: 0x3d454c,
    label: '#e6ebef',
    snake: 0xf08a72,
    arrow: 0x5fc684,
    win: 0xe0b544,
    piece: 0xff5cf7,
    halo: 0xffffff,
    ambient: 1.5,
    key: 1.7,
  },
};

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
