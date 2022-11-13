import i18next from 'i18next'
import HttpApi from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'
import * as RNLocalize from 'react-native-localize'

const locales = RNLocalize.getLocales()

export const lang = locales[0].languageCode

i18next
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    backend: {
      allowMultiLoading: false,
      loadPath:
        'https://leelachakra.com/resource/LeelaChakra/translations/{{lng}}/{{ns}}.json',
    },
    compatibilityJSON: 'v3',
    ns: ['common', 'validation', 'rules', 'plans'],
    defaultNS: 'common',
    lng: lang,
    fallbackLng: 'en',
    debug: __DEV__,
    interpolation: {
      escapeValue: true,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18next
