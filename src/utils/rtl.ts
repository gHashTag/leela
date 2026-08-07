import { I18nManager } from 'react-native'
import * as RNLocalize from 'react-native-localize'

/**
 * RTL languages that need mirrored layouts.
 */
export const RTL_LANGS = ['ar']

/**
 * Whether the device locale is RTL.
 */
export const isDeviceRTL = (): boolean => {
  const locales = RNLocalize.getLocales()
  return locales.length > 0 ? locales[0].isRTL : false
}

/**
 * Whether the currently selected language requires RTL layout.
 * Use this to decide when to force `I18nManager` or apply local RTL styles.
 */
export const isRTLLanguage = (lang: string): boolean => RTL_LANGS.includes(lang)

/**
 * Synchronize React Native's layout direction with the given language.
 * Call once during app bootstrap after the language has been resolved.
 *
 * Note: changing `I18nManager` requires a reload to take full effect, so this
 * helper returns whether a reload is recommended.
 */
export const syncRTLDirection = (lang: string): boolean => {
  const shouldBeRTL = isRTLLanguage(lang)
  const currentRTL = I18nManager.isRTL
  if (shouldBeRTL !== currentRTL) {
    I18nManager.allowRTL(shouldBeRTL)
    I18nManager.forceRTL(shouldBeRTL)
    return true
  }
  return false
}

/**
 * A subset of flex/position styles that should be flipped for RTL.
 * Use as a fallback for components that do not inherit automatic RTL flipping.
 */
export const rtlAware = {
  flexDirection: 'row-reverse' as const
}
