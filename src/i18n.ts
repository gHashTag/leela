import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as RNLocalize from 'react-native-localize'

import en from './utils/locales/en'
import ru from './utils/locales/ru'

const locales = RNLocalize.getLocales()

export const lang = locales[0].languageCode

i18next.use(initReactI18next).init({
  lng: lang,
  fallbackLng: 'en',
  debug: __DEV__,
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
})

export default i18next
