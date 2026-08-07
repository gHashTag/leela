/**
 * Minimum touch-target size per iOS Human Interface Guidelines and
 * Android Material Design accessibility recommendations.
 */
export const MIN_TOUCH_SIZE = 44

/**
 * Reusable style that guarantees a 44×44 pt touch area while keeping
 * the visible content centered. Merge it into the outer Pressable or
 * wrapper of small icons.
 */
export const minTouchTarget = {
  minWidth: MIN_TOUCH_SIZE,
  minHeight: MIN_TOUCH_SIZE,
  justifyContent: 'center' as const,
  alignItems: 'center' as const
}
