import { useEffect, useState } from 'react'

import { AccessibilityInfo } from 'react-native'

/**
 * Reactive hook for the system Reduce Motion setting.
 *
 * Some users cannot tolerate motion; this lets animated components skip
 * or shorten animations without needing to poll AccessibilityInfo.
 */
export const useReducedMotion = (): boolean => {
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    const get = async () => {
      try {
        const value = await AccessibilityInfo.isReduceMotionEnabled()
        if (mounted) setEnabled(value)
      } catch {
        if (mounted) setEnabled(false)
      }
    }
    get()
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        if (mounted) setEnabled(value)
      }
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return enabled
}
