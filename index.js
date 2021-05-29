/**
 * @format
 */
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import React from 'react'
import { AppRegistry, LogBox } from 'react-native'
import Purchases from 'react-native-purchases'
import TrackPlayer from 'react-native-track-player'
import { configure } from 'mobx'
import * as Sentry from '@sentry/react-native'
import { revenuecat } from './src/constants'
import App from './src'
import { name as appName } from './app.json'
import { Integrations } from '@sentry/tracing'

const routingInstrumentation = new Sentry.ReactNavigationV5Instrumentation()

Sentry.init({
  dsn: 'https://1d8f316fe05b48f9b712acf5035683fb@o749286.ingest.sentry.io/5791363',
  release: 'leela@' + process.env.npm_package_version,
  tracesSampleRate: 0.2,

  integrations: [
    new Sentry.ReactNativeTracing({
      tracingOrigins: ['localhost', /^\//],
      routingInstrumentation
      // ... other options
    })
  ]
  // integrations: [new TracingIntegrations.BrowserTracing()],
  // // To set a uniform sample rate
})

configure({
  enforceActions: 'never'
})

LogBox.ignoreLogs([
  'Require cycle: node_modules/react-native/Libraries/Network/fetch.js',
  'RCTBridge required',
  'Warning: AsyncStorage',
  'Warning: componentWillReceiveProps',
  'RCTRootView cancelTouches',
  'not authenticated',
  'Sending `onAnimatedValueUpdate`',
  'Animated: `useNativeDriver`',
  "Can't perform a React",
  'Trying to load',
  'Setting a timer for a long period of time',
  'Sending'
])

TrackPlayer.registerPlaybackService(() => require('./service'))

class Init extends React.Component {
  componentDidMount() {
    Purchases.setDebugLogsEnabled(true)
    Purchases.setup(revenuecat)
  }

  render() {
    return <App />
  }
}

AppRegistry.registerComponent(appName, () => Init)
