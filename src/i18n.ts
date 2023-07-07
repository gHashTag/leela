import i18next from 'i18next'
import HttpApi from 'i18next-http-backend'
import { isoCountry } from 'iso-country'
import { initReactI18next } from 'react-i18next'
import * as RNLocalize from 'react-native-localize'

const locales = RNLocalize.getLocales()

export const lang = locales[0].languageCode
export const flagEmoji = isoCountry(locales[0].countryCode)?.emoji ?? '🇷🇺'

export const supportedLngs = [
  'ar',
  'bn',
  'en',
  'es',
  'fr',
  'hi',
  'id',
  'pt',
  'ru',
  'zh',
  'mr',
  'ms',
  'te',
  'tr',
  'uk',
]

export const isSupportedLang = supportedLngs.includes(locales[0].languageCode)
export const ruOrEnLang = locales[0].languageCode === 'ru' ? 'ru' : 'en'

function initializeI18n() {
  return new Promise((resolve, reject) => {
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
        supportedLngs,
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
        initImmediate: false,
      })

    i18next.on('initialized', resolve)
    i18next.on('failedLoading', reject)
  })
}

initializeI18n()
  .then(() => {
    const translatedText = i18next.t('gameMode')
    console.log(translatedText)
    console.log('Translations are loaded')
  })
  .catch(error => {
    console.error('Error while initializing i18next:', error)
  })

console.log('Waiting for i18next to initialize...')

export default i18next
