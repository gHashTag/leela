import I18n from 'i18n-js'
import { NativeModules, Platform } from 'react-native'
import * as RNLocalize from 'react-native-localize'

import en from './locales/en'
import ru from './locales/ru'

const locales = RNLocalize.getLocales()

if (Array.isArray(locales)) {
  I18n.locale = locales[0].languageTag
}

I18n.fallbacks = true
I18n.translations = {
  en,
  ru,
}

const deviceLanguage =
  Platform.OS === 'ios'
    ? NativeModules.SettingsManager.settings.AppleLocale ||
      NativeModules.SettingsManager.settings.AppleLanguages[0] //iOS 13
    : NativeModules.I18nManager.localeIdentifier

const langOS = deviceLanguage.slice(0, 2)
const AllLang = langOS

const lang = langOS === 'en' || langOS === 'ru' ? langOS : 'en'
//
export { lang, I18n, AllLang }
export * from './linking'
