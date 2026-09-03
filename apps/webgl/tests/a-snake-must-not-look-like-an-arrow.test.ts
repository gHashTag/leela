/**
 * A snake and an arrow must never be the same thing at a glance, and neither
 * may vanish into the ground it lies on.
 *
 * Snake-versus-arrow is the one distinction the game rests on. Landing on 12
 * sends you to 8 or to 51 depending on which of the two you are looking at, and
 * a player reading a board in three dimensions, at an angle, on a phone, gets
 * one glance. Nothing checked it: the palette had no test at all, and the
 * defect shipped as four of nine colours in one sandy band — the shaft
 * `0x9a7648`, the tan viper, the sand and the dark brown.
 *
 * The ground rule is here because fixing the first defect caused a second
 * within the hour. Lifting the shared shaft to bone made the void board read
 * perfectly and made **every arrow on the paper board disappear**: pale wood on
 * a cream table. A test that only knew about snakes would have stayed green
 * through that.
 *
 * Two axes, not one, and that is the part worth reading. On the void the
 * arrow is pale and the snakes are dark, so WCAG contrast measures it — 3:1,
 * the standard's own threshold for non-text graphics that must be told apart.
 * **On paper that axis does not exist.** A search over the whole cube says the
 * best any colour can manage is 2.42:1 against the nearest snake while still
 * clearing the paper at 3:1, and only as hot pink: the ground forces the arrow
 * dark, and dark is where all six snakes already live. Requiring 3:1 there
 * would be requiring the impossible, and a threshold nothing can satisfy gets
 * deleted rather than met.
 *
 * So the rule is: distinguishable on EITHER axis — contrast, or perceptual
 * distance in CIELAB. That is what lets the paper board answer with hue instead
 * of lightness, which is why its arrow is blued steel while the void's is bone.
 * A hue rule alone would have been wrong the other way: `theme.ts` argues for
 * naturalistic skins, an olive python beside a madder-red one, and those two
 * are close in hue on purpose.
 */

import { describe, expect, it } from 'vitest';
import { PAPER, SNAKE_SKINS, SPACE, type Palette } from '../src/theme';

/** WCAG 2.1 relative luminance of an `0xrrggbb` colour. */
const luminance = (colour: number): number => {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((colour >> 16) & 0xff) +
    0.7152 * channel((colour >> 8) & 0xff) +
    0.0722 * channel(colour & 0xff)
  );
};

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
const contrast = (a: number, b: number): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** CIELAB, D65, for the perceptual axis. */
const lab = (colour: number): [number, number, number] => {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const r = channel((colour >> 16) & 0xff);
  const g = channel((colour >> 8) & 0xff);
  const b = channel(colour & 0xff);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

/** CIE76 colour difference. Roughly: 2 is a just-noticeable step. */
const deltaE = (a: number, b: number): number => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/**
 * What is actually behind the pieces in each scheme.
 *
 * One ground, not two. `groundMaterial.opacity` is 0 in `scene.ts` and stays
 * there — the slab exists so the raycaster has something to hit — so on the
 * void `palette.cell` is never seen and the ground is the black `background`.
 * On the table there is no background at all and the painted cell is the page.
 * Checking both would have failed the bone shaft against a beige nobody can
 * see, which is a false alarm, and a check that cries wolf gets waived.
 */
const ground = (p: Palette): number => p.background ?? p.cell;

const arrowParts = (p: Palette): number[] => [p.arrowWood, p.arrowSteel, p.arrowFeather];

const SCHEMES: ReadonlyArray<readonly [string, Palette]> = [
  ['void', SPACE],
  ['paper', PAPER],
];

/** Visible against the ground. WCAG's own number for non-text graphics. */
const SEEN = 3;
/** Or clearly a different colour. Well past a just-noticeable difference. */
const APART = 18;

/** The board as it shipped, and as it must never ship again. */
const AS_IT_WAS = {
  wood: 0x9a7648,
  skins: [0x4c5240, 0x7d3a2c, 0x6d5c3c, 0x2f3a35, 0x8a6f4a, 0x5a4038],
  paperCell: 0xe8e0cd,
} as const;

describe('a snake must not look like an arrow', () => {
  for (const [name, palette] of SCHEMES) {
    it(`${name}: every arrow part is distinguishable from every snake`, () => {
      const same = [];
      for (const part of arrowParts(palette)) {
        for (const skin of SNAKE_SKINS) {
          const byLight = contrast(part, skin);
          const byHue = deltaE(part, skin);
          if (byLight < SEEN && byHue < APART) {
            same.push(
              `${hex(part)} vs ${hex(skin)}: contrast ${byLight.toFixed(2)}, ΔE ${byHue.toFixed(1)}`,
            );
          }
        }
      }
      expect(same).toEqual([]);
    });

    it(`${name}: nothing on the board vanishes into the board`, () => {
      // ΔE, not contrast, and the reason is physical rather than stylistic:
      // these are lit 3D objects. A key light multiplies the piece and the
      // ground alike, so two things with the same albedo stay identical under
      // any lighting — while a piece merely DARKER than its ground is still a
      // visible shape. Contrast measures the wrong thing here, and measuring
      // it called six perfectly visible snakes invisible on black.
      const behind = ground(palette);
      const lost = [];
      for (const piece of [...arrowParts(palette), ...SNAKE_SKINS]) {
        const apart = deltaE(piece, behind);
        if (apart < APART) lost.push(`${hex(piece)} on ${hex(behind)}: ΔE ${apart.toFixed(1)}`);
      }
      expect(lost).toEqual([]);
    });
  }

  it('fails on both palettes that were live, or it is checking nothing', () => {
    // Two controls, because two different defects were found and a threshold
    // that catches neither has not been shown to work. Both of these shipped.

    // The one that was on t27.ai: snakes the same colour as the shaft.
    const mistaken = AS_IT_WAS.skins.filter(
      (skin) => contrast(skin, AS_IT_WAS.wood) < SEEN && deltaE(skin, AS_IT_WAS.wood) < APART,
    );
    expect(mistaken.length).toBeGreaterThan(0);

    // The one I caused an hour later: a bone shaft on the old cream table.
    // It is the ground rule that has to catch this one, so it is measured the
    // way the ground rule measures.
    expect(deltaE(SPACE.arrowWood, AS_IT_WAS.paperCell)).toBeLessThan(APART);
  });

  it('does not force the snakes apart from each other', () => {
    // Deliberately NOT asserted between snakes. They are all snakes; two that
    // look alike cost a player nothing, and six mutually distant colours is
    // what would destroy the naturalism theme.ts argues for. Their minimum
    // ΔE is about 4 — a just-noticeable step, on purpose.
    const between = SNAKE_SKINS.flatMap((a, i) =>
      SNAKE_SKINS.slice(i + 1).map((b) => deltaE(a, b)),
    );
    expect(Math.min(...between)).toBeLessThan(APART);
  });
});
