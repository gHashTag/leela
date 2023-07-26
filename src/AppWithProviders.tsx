import React, { useEffect } from 'react'

import notifee from '@notifee/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import { configure } from 'mobx'
import { configurePersistable } from 'mobx-persist-store'
import { AppState, LogBox, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import SplashScreen from 'react-native-splash-screen'
import VersionInfo from 'react-native-version-info'

import Navigation from './Navigation'
import { RevenueCatProvider } from './providers/RevenueCatProvider'
import { updateAndroidBadgeCount } from './utils/notifications/NotificationHelper'

const routingInstrumentation = new Sentry.ReactNavigationInstrumentation()

configurePersistable(
  {
    storage: AsyncStorage,
    debugMode: false,
  },
  { delay: 200 },
)

Sentry.init({
  dsn: 'https://1d8f316fe05b48f9b712acf5035683fb@o749286.ingest.sentry.io/5791363',
  release: `leela@${VersionInfo.appVersion}.${VersionInfo.buildVersion}`,
  tracesSampleRate: 0.2,
  integrations: [
    new Sentry.ReactNativeTracing({
      tracingOrigins: ['localhost', /^\//],
      routingInstrumentation,
    }),
  ],
})

configure({
  enforceActions: 'never',
})

LogBox.ignoreLogs([
  'Please report: Excessive number of pending callbacks: 501',
  'i18next::translator: key "gameMode" for languages "ru, en"',
  'i18next: hasLoadedNamespace: i18next was not initialized',
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
  'source.uri should not be an empty string',
  'VirtualizedLists should never be nested inside plain ScrollViews',
  'i18next::translator: Seems the loaded translations',
])

function AppWithProviders() {
  useEffect(() => {
    SplashScreen.hide()
    const unsub = AppState.addEventListener('change', async state => {
      if (state === 'active') {
        updateAndroidBadgeCount({ type: 'clear' })
        await notifee.setBadgeCount(0)
      }
    })
    return unsub.remove
  }, [])

  return (
    <RevenueCatProvider>
      <SafeAreaProvider>
        <GestureHandlerRootView style={page.flexOne}>
          <Navigation />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </RevenueCatProvider>
  )
}

const page = StyleSheet.create({
  flexOne: { flex: 1 },
})

export default Sentry.wrap(AppWithProviders)
