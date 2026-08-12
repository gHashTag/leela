import { useEffect, useState } from 'react'

import { AccessibilityInfo } from 'react-native'

/**
 * Reactive hook for whether a screen reader (VoiceOver / TalkBack) is on.
 *
 * Use this to guard expensive imperative announcements so they only fire when
 * someone is actually listening.
 */
export const useScreenReader = (): boolean => {
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    const get = async () => {
      try {
        const value = await AccessibilityInfo.isScreenReaderEnabled()
        if (mounted) setEnabled(value)
      } catch {
        if (mounted) setEnabled(false)
      }
    }
    get()
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
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
