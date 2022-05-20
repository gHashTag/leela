import React from 'react'
import { LogBox, Platform } from 'react-native'
import { configure } from 'mobx'
import { configurePersistable } from 'mobx-persist-store'
import * as Sentry from '@sentry/react-native'
import VersionInfo from 'react-native-version-info'
import App from './src'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'

const routingInstrumentation = new Sentry.ReactNavigationV5Instrumentation()

configurePersistable(
  {
    storage: AsyncStorage,
    debugMode: false
  },
  { delay: 200 }
)

Sentry.init({
  dsn: 'https://1d8f316fe05b48f9b712acf5035683fb@o749286.ingest.sentry.io/5791363',
  release: `leela@${VersionInfo.appVersion}.${VersionInfo.buildVersion}`,
  tracesSampleRate: 0.2,
  integrations: [
    new Sentry.ReactNativeTracing({
      tracingOrigins: ['localhost', /^\//],
      routingInstrumentation
      // ... other options
    })
  ]
  //debug: true
  // // To set a uniform sample rate
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
  'Non-serializable values were found in the navigation'
])

// TrackPlayer.registerPlaybackService(() => require('./service'))

class Init extends React.Component {
  // componentDidMount() {
  //   Purchases.setDebugLogsEnabled(true)
  //   Purchases.setup(revenuecat)
  // }

  render() {
    return (
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>
    )
  }
}

export default Sentry.wrap(Init)
