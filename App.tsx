/**
 * @format
 */
import React from 'react'
import { LogBox, Platform } from 'react-native'
import Amplify from '@aws-amplify/core'
import { Auth, DataStore } from 'aws-amplify'
import Purchases from 'react-native-purchases'
// import TrackPlayer from 'react-native-track-player'
import { configure } from 'mobx'
import * as Sentry from '@sentry/react-native'
import { SQLiteAdapter } from '@aws-amplify/datastore-storage-adapter'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import { v4 as uuidv4 } from 'uuid'
import VersionInfo from 'react-native-version-info'
import { LocalNotification } from './src/utils/noifications/LocalPushController'
import messaging from '@react-native-firebase/messaging'
import awsconfig from './src/aws-exports'
import { revenuecat } from './src/constants'
import App from './src'
//import StorybookUI from './storybook'

//Amplify.Logger.LOG_LEVEL = 'DEBUG'

Auth.configure(awsconfig)

DataStore.configure({
  storageAdapter: SQLiteAdapter
})

Amplify.configure(awsconfig)

const routingInstrumentation = new Sentry.ReactNavigationV5Instrumentation()

messaging().setBackgroundMessageHandler(async payload => {
  Platform.OS === 'ios'
    ? PushNotificationIOS.addNotificationRequest({
        id: uuidv4(),
        title: payload.data?.title,
        body: payload.data?.body
      })
    : LocalNotification(payload)
})

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

// TrackPlayer.registerPlaybackService(() => require('./service'))

class Init extends React.Component {
  componentDidMount() {
    Purchases.setDebugLogsEnabled(true)
    Purchases.setup(revenuecat)
  }

  render() {
    return <App />
  }
}

export default Init
