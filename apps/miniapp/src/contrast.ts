/**
 * Contrast, measured rather than eyeballed.
 *
 * The board's snake, arrow and win colours were picked by eye and sat between
 * 3.0 and 4.5 against the surface they are drawn on — below what small text
 * needs, in both themes at once, which is what happens when one palette serves
 * a light and a dark background.
 *
 * WCAG 2.1: 4.5:1 for body text, 3:1 for large text and for non-text marks.
 */

export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/** Parse `#rrggbb` or `#rgb` into 0..1 channels. */
export function channels(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new RangeError(`not a hex colour: ${hex}`);
  }

  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** Relative luminance, per WCAG. */
export function luminance(hex: string): number {
  // Named rather than destructured out of a mapped array: three channels are
  // three values, and an array says only that there are some.
  const [red, green, blue] = channels(hex);
  const linear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Contrast ratio between two colours, 1 to 21. Order does not matter. */
export function contrast(a: string, b: string): number {
  const [first, second] = [luminance(a), luminance(b)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export interface Palette {
  surface: string;
  snake: string;
  arrow: string;
  win: string;
}

/**
 * The two palettes the stylesheet defines.
 *
 * Duplicated from CSS deliberately: a test cannot read a custom property out
 * of a stylesheet without a browser, and a palette nobody checks is how the
 * original one drifted below the threshold unnoticed. If these change, change
 * `style.css` too — the test will not know, but the numbers will.
 */
export const LIGHT: Palette = {
  surface: '#f2f2f6',
  snake: '#a3301c',
  arrow: '#1f6b39',
  win: '#7a5a12',
};

export const DARK: Palette = {
  surface: '#1a1a1c',
  snake: '#f08a72',
  arrow: '#5fc684',
  win: '#e0b544',
};

/** Every mark measured against the surface it is drawn on. */
export function measurePalette(palette: Palette): Array<{ name: string; ratio: number }> {
  return (['snake', 'arrow', 'win'] as const).map((name) => ({
    name,
    ratio: contrast(palette[name], palette.surface),
  }));
}
