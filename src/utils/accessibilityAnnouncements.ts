import { AccessibilityInfo, Platform } from 'react-native'

import { captureException } from '../constants'

/**
 * Cross-platform helper for forcing a screen-reader announcement.
 *
 * React Native's accessibilityLiveRegion only works on Android/TalkBack.
 * VoiceOver on iOS ignores it, so for dynamic game state (turn changes,
 * dice results, win events) we must call announceForAccessibility explicitly.
 *
 * The helper is safe to call even when no screen reader is enabled: the
 * underlying API is a no-op in that case.
 */
export function announceForAccessibility(message: string): void {
  if (!message) return
  try {
    AccessibilityInfo.announceForAccessibility(message)
  } catch (error) {
    captureException(error, 'announceForAccessibility')
  }
}

/**
 * Whether to prefer the imperative iOS announcement path.
 *
 * On Android we still rely on accessibilityLiveRegion for polite updates, but
 * for important game events we announce everywhere.
 */
export const shouldUseImperativeAnnouncements = Platform.OS === 'ios'
