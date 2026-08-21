import {
  applyFontScale,
  clampFontScale,
  isAccessibilityFontScale,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE
} from './fontScale'

describe('fontScale utilities', () => {
  it('exposes safe scale bounds', () => {
    expect(MIN_FONT_SCALE).toBe(1.0)
    expect(MAX_FONT_SCALE).toBe(1.6)
  })

  it('clamps a normal system scale unchanged', () => {
    expect(clampFontScale(1.0)).toBe(1.0)
    expect(clampFontScale(1.2)).toBe(1.2)
  })

  it('caps oversized system font scales', () => {
    expect(clampFontScale(2.0)).toBe(MAX_FONT_SCALE)
    expect(clampFontScale(10)).toBe(MAX_FONT_SCALE)
  })

  it('never scales below the base size', () => {
    expect(clampFontScale(0.8)).toBe(MIN_FONT_SCALE)
    expect(clampFontScale(0)).toBe(MIN_FONT_SCALE)
  })

  it('scales fontSize and lineHeight', () => {
    const scaled = applyFontScale(
      { fontSize: 20, lineHeight: 24, color: 'red' },
      1.2
    )
    expect(scaled.fontSize).toBe(24)
    expect(scaled.lineHeight).toBeCloseTo(28.8)
    expect(scaled.color).toBe('red')
  })

  it('ignores non-numeric font sizes', () => {
    const scaled = applyFontScale(
      { fontSize: 'large', lineHeight: undefined },
      1.2
    )
    expect(scaled.fontSize).toBe('large')
    expect(scaled.lineHeight).toBeUndefined()
  })

  it('flags accessibility-sized scales', () => {
    expect(isAccessibilityFontScale(1.35)).toBe(true)
    expect(isAccessibilityFontScale(1.6)).toBe(true)
    expect(isAccessibilityFontScale(1.2)).toBe(false)
  })
})
