import {
  AccessibilityInfo,
  ColorSchemeName,
  useColorScheme
} from 'react-native'

/**
 * Bridge to iOS system accessibility settings that React Native exposes
 * but does not always make easy to read synchronously.
 *
 * We use this for Reduce Motion gating. Other settings (Bold Text, Increase
 * Contrast, Reduce Transparency) are harder to query cross-platform, so the
 * app relies on the user's chosen theme (including high contrast) for those.
 */
export const isReduceMotionEnabled = async (): Promise<boolean> => {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled()
  } catch {
    return false
  }
}

/**
 * Hook that returns the effective color scheme, treating the user's chosen
 * high-contrast theme as an override of the system scheme.
 *
 * This lets components react to "dark high contrast" even though RN's
 * useColorScheme only knows "dark".
 */
export const useEffectiveColorScheme = (
  theme: 'system' | 'light' | 'dark' | 'highContrast'
): ColorSchemeName => {
  const scheme = useColorScheme()
  if (theme === 'highContrast') {
    // Keep the system light/dark base, components layer high-contrast styles on top.
    return scheme ?? 'dark'
  }
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  return scheme
}
