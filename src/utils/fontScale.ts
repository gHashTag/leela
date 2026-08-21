import { useWindowDimensions } from 'react-native'

/**
 * Maximum font scale multiplier applied from the system dynamic-type setting.
 * Capping the scale keeps oversized system fonts from breaking layouts that
 * were not designed for very large type (e.g. the game board and tab bar).
 */
export const MAX_FONT_SCALE = 1.6

/**
 * Minimum font scale multiplier. We never shrink text below the base size.
 */
export const MIN_FONT_SCALE = 1.0

/**
 * Clamp a raw system font scale to the supported range.
 */
export const clampFontScale = (scale: number): number =>
  Math.max(MIN_FONT_SCALE, Math.min(scale, MAX_FONT_SCALE))

/**
 * Current system font scale, capped for layout safety.
 */
export const useFontScale = (): number => {
  const { fontScale } = useWindowDimensions()
  return clampFontScale(fontScale)
}

/**
 * Multiply numeric `fontSize` and `lineHeight` values in a style object by the
 * given scale. Non-numeric values and other style properties are returned
 * unchanged so the result can be spread back into a Text style.
 */
export const applyFontScale = (
  style: Record<string, any>,
  scale: number
): Record<string, any> => {
  if (!style) {
    return style
  }
  const scaled: Record<string, any> = { ...style }
  if (typeof scaled.fontSize === 'number') {
    scaled.fontSize = scaled.fontSize * scale
  }
  if (typeof scaled.lineHeight === 'number') {
    scaled.lineHeight = scaled.lineHeight * scale
  }
  return scaled
}

/**
 * Whether the current capped font scale is large enough to be considered an
 * accessibility size. Use this to switch layouts (e.g. stack rows into columns)
 * when text becomes too large for the default design.
 */
export const isAccessibilityFontScale = (scale: number): boolean =>
  scale >= 1.35
