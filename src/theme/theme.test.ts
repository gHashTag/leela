import { readFileSync } from 'fs'
import { join } from 'path'

import { RADIUS, SPACE, TOUCH, TYPE, paletteFor } from './index'

/**
 * One palette, two grounds, and the same values the board uses.
 *
 * The app had sixteen colours named after what they are — `classicRose`,
 * `mustard` — none of which can have a dark counterpart, and screens holding
 * literals besides. This checks the replacement is a system rather than a
 * seventeenth colour.
 */

/** How readable one colour is on another. WCAG's own formula, not an opinion. */
const contrast = (a: string, b: string): number => {
  const channel = (hex: string, at: number): number => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = (hex: string): number => {
    const h = hex.replace('#', '')
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h
    return (
      0.2126 * channel(full, 0) +
      0.7152 * channel(full, 2) +
      0.0722 * channel(full, 4)
    )
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('the two grounds', () => {
  it('are not each other inverted', () => {
    // The mistake this repository has made three times, recorded in the board's
    // own comments: a colour measured against one ground carried onto another.
    // Each palette is measured for itself, so no pair may simply swap.
    const dark = paletteFor(true)
    const light = paletteFor(false)
    expect(light.accent).not.toBe(dark.accent)
    expect(light.hint).not.toBe(dark.hint)
    expect(light.danger).not.toBe(dark.danger)
  })

  it('carry every role in both', () => {
    // A role missing from one scheme is a screen that renders `undefined` —
    // which React Native draws as black on black.
    const dark = paletteFor(true)
    const light = paletteFor(false)
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
    // The role name goes into the compared value rather than into a message,
    // so a failure still says which one: jest's `expect` takes no second
    // argument, and I have now written vitest's two-argument form into a jest
    // suite twice in one day.
    expect(Object.entries(light).filter(([, value]) => !value)).toEqual([])
  })
})

describe('what can be read', () => {
  it('puts body text well clear of the page it sits on', () => {
    // 4.5 is the threshold small text needs. The app's own `contrast.test.ts`
    // in the monorepo found three pairs below it by measuring rather than by
    // looking, and one of them had erased a button's label.
    for (const dark of [true, false]) {
      const p = paletteFor(dark)
      expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the way out visible on both grounds', () => {
    // The reason this role exists: the skip link was drawn in `accent` over a
    // pale card and could not be found. A colour nobody can see is not a way
    // out. 3.0 rather than 4.5 - it is a large, underlined control, which is
    // the threshold WCAG sets for text of that size.
    for (const dark of [true, false]) {
      const p = paletteFor(dark)
      expect(contrast(p.escape, p.bg)).toBeGreaterThanOrEqual(3)
    }
  })

  it('does not use the same colour for the way out and the way on', () => {
    // `accent` is what you are meant to do; `escape` is the way past it. One
    // colour for both is what made the link disappear.
    for (const dark of [true, false]) {
      const p = paletteFor(dark)
      expect(p.escape).not.toBe(p.accent)
    }
  })

  it('keeps the quieter text readable too', () => {
    // `hint` is a whole class of sentence in this app — the line under the
    // board, the plan numbers, every helper. Dimmed is not the same as faint.
    for (const dark of [true, false]) {
      const p = paletteFor(dark)
      expect(contrast(p.hint, p.bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives a button label enough against its own fill', () => {
    for (const dark of [true, false]) {
      const p = paletteFor(dark)
      expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('the same values as the board', () => {
  it('does not drift from the page it sits beside', () => {
    // Two surfaces of one game. The board's stylesheet is the source; these are
    // copies, and a copy that is only checked by eye stops being one.
    const css = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'leela',
        'apps',
        'webgl',
        'src',
        'style.css'
      ),
      'utf8'
    )
    const light = paletteFor(false)
    const dark = paletteFor(true)

    expect(css).toContain(`--bg: ${dark.bg}`)
    expect(css).toContain(`--text: ${dark.text}`)
    expect(css).toContain(`--bg: ${light.bg}`)
    expect(css).toContain(`--text: ${light.text}`)
  })
})

describe('the measure', () => {
  it('rises, so a gap is always bigger than the one below it', () => {
    const steps = [SPACE.xs, SPACE.sm, SPACE.md, SPACE.lg, SPACE.xl]
    for (let at = 1; at < steps.length; at += 1) {
      expect(steps[at]).toBeGreaterThan(steps[at - 1] as number)
    }
  })

  it('keeps type on a rising ladder as well', () => {
    const sizes = [TYPE.small, TYPE.body, TYPE.title, TYPE.head, TYPE.hero]
    for (let at = 1; at < sizes.length; at += 1) {
      expect(sizes[at]).toBeGreaterThan(sizes[at - 1] as number)
    }
  })

  it('keeps a control touchable', () => {
    // Apple's number, not ours.
    expect(TOUCH).toBeGreaterThanOrEqual(44)
    expect(RADIUS).toBeGreaterThan(0)
  })
})
