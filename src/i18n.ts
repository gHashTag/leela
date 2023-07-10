import i18next from 'i18next'
import { isoCountry } from 'iso-country'
import { initReactI18next } from 'react-i18next'
import * as RNLocalize from 'react-native-localize'

import en from './locales/en/translation.json'
import ru from './locales/ru/translation.json'

const locales = RNLocalize.getLocales()

if (!Array.isArray(locales) || locales.length === 0) {
  throw new Error('No locales found')
}

export const lang = locales[0]?.languageCode
if (!lang) {
  throw new Error('No language code found for first locale')
}

export const flagEmoji = isoCountry(locales[0]?.countryCode)?.emoji ?? '🇷🇺'

const resources = {
  en: {
    translation: en,
  },
  ru: {
    translation: ru,
  },
}

for (const [key, value] of Object.entries(resources)) {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Invalid locale data for language ${key}`)
  }
}

export const supportedLngs = ['en', 'ru']

export const isSupportedLang = supportedLngs.includes(lang)
export const ruOrEnLang = lang === 'ru' ? 'ru' : 'en'

i18next.use(initReactI18next).init(
  {
    compatibilityJSON: 'v3',
    resources,
    lng: isSupportedLang ? lang : ruOrEnLang,
    debug: __DEV__,
    interpolation: {
      escapeValue: true,
    },
    react: {
      useSuspense: false,
    },
  },
  err => {
    if (err) {
      console.error('Error initializing i18next:', err)
    }
  },
)

export default i18next
