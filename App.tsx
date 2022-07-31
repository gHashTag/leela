import React, { useEffect } from 'react'
import { AppState, LogBox, Platform } from 'react-native'
import { configure } from 'mobx'
import { configurePersistable } from 'mobx-persist-store'
import * as Sentry from '@sentry/react-native'
import VersionInfo from 'react-native-version-info'
import App from './src'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  PowerTranslator,
  ProviderTypes,
  TranslatorConfiguration,
  TranslatorFactory
} from 'react-native-power-translator'
import Purchases from 'react-native-purchases'
// @ts-expect-error
import { GOOGLE_TRANSLATE_API_KEY } from '@env'
import { lang } from './src/utils'
import SplashScreen from 'react-native-splash-screen'
import notifee from '@notifee/react-native'
const routingInstrumentation = new Sentry.ReactNavigationV5Instrumentation()

configurePersistable(
  {
    storage: AsyncStorage,
    debugMode: false
  },
  { delay: 200 }
)

TranslatorConfiguration.setConfig(ProviderTypes.Google, GOOGLE_TRANSLATE_API_KEY, lang)

Sentry.init({
  dsn: 'https://1d8f316fe05b48f9b712acf5035683fb@o749286.ingest.sentry.io/5791363',
  release: `leela@${VersionInfo.appVersion}.${VersionInfo.buildVersion}`,
  tracesSampleRate: 0.2,
  integrations: [
    new Sentry.ReactNativeTracing({
      tracingOrigins: ['localhost', /^\//],
      routingInstrumentation
    })
  ]
})

configure({
  enforceActions: 'never'
})

LogBox.ignoreLogs([
  'Require cycle: node_modules/react-native/Libraries/Network/fetch.js',
  'RCTBridge required',
  'Warning: componentWillReceiveProps',
  'RCTRootView cancelTouches',
  'not authenticated',
  'Sending `onAnimatedValueUpdate`',
  'Animated: `useNativeDriver`',
  "Can't perform a React",
  'Trying to load',
  'Setting a timer for a long period of time',
  'Sending',
  'Non-serializable values were found in the navigation',
  'ViewPropTypes will be removed',
  'source.uri should not be an empty string'
])

function Init() {
  useEffect(() => {
    SplashScreen.hide()
    // if (Platform.OS === 'ios') {
    //   Purchases.setup('appl_ACmucVIVHSuJWCXwWfYUzJlXKno')
    // } else if (Platform.OS === 'android') {
    //   Purchases.setup('goog_hpKzEpktquSkYpVmjVilrzYRvTn')
    // }
    const unsub = AppState.addEventListener('change', async state => {
      if (state === 'active') {
        await notifee.setBadgeCount(0)
      }
    })
    return () => {
      unsub.remove()
    }
  }, [])
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  )
}

export default Sentry.wrap(Init)
