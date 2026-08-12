import {
  HapticFeedbackTypes,
  trigger
} from 'react-native-haptic-feedback'

const DEFAULT_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false
}

let hapticEnabledGlobally = true

/**
 * Allow the app to disable haptics globally from settings.
 *
 * Defaults to true; callers should load the user preference at startup.
 */
export function setHapticEnabled(enabled: boolean): void {
  hapticEnabledGlobally = enabled
}

/**
 * Trigger a haptic feedback effect.
 *
 * In tests or on devices without Taptic Engine support the library falls
 * back to vibration. The call is wrapped in a try/catch so a haptics
 * failure never breaks the user flow.
 *
 * Respects the global haptic enabled flag so users can turn haptics off.
 */
export function triggerHaptic(
  type: keyof typeof HapticFeedbackTypes = 'impactLight'
): void {
  if (!hapticEnabledGlobally) return
  try {
    trigger(HapticFeedbackTypes[type], DEFAULT_OPTIONS)
  } catch (error) {
    // Haptics are best-effort; never throw to callers.
  }
}
