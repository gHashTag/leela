/**
 * @format
 */
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import React from 'react'
import { AppRegistry, LogBox, Platform } from 'react-native'
import Amplify from '@aws-amplify/core'
import Purchases from 'react-native-purchases'
import TrackPlayer from 'react-native-track-player'
import { configure } from 'mobx'
import * as Sentry from '@sentry/react-native'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import { v4 as uuidv4 } from 'uuid'
import VersionInfo from 'react-native-version-info'
import * as Keychain from 'react-native-keychain'
import { LocalNotification } from './src/utils/noifications/LocalPushController'
import messaging from '@react-native-firebase/messaging'
import awsconfig from './src/aws-exports'
import { revenuecat } from './src/constants'
import App from './src'
import { name as appName } from './app.json'
//import StorybookUI from './storybook'

const MEMORY_KEY_PREFIX = '@MyStorage:'

let dataMemory: any = {}

class MyStorage {
  static syncPromise = null

  static setItem(key: string, value: string): boolean {
    Keychain.setGenericPassword(MEMORY_KEY_PREFIX + key, value)
    dataMemory[key] = value
    return dataMemory[key]
  }

  static getItem(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(dataMemory, key) ? dataMemory[key] : undefined
  }

  static removeItem(key: string): boolean {
    Keychain.resetGenericPassword()
    return delete dataMemory[key]
  }

  static clear(): object {
    dataMemory = {}
    return dataMemory
  }
}

Amplify.configure({
  ...awsconfig,
  Analytics: {
    disabled: false
  },
  storage: MyStorage
})

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
//AppRegistry.registerComponent(appName, () => (__DEV__ ? StorybookUI : Init))
