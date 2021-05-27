/**
 * @format
 */
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import React from 'react'
import { AppRegistry, LogBox } from 'react-native'
import Purchases from 'react-native-purchases'
import Amplify from 'aws-amplify'
import TrackPlayer from 'react-native-track-player'

import awsconfig from './aws-exports'
import { configure } from 'mobx'
import { revenuecat } from './src/constants'
import App from './src'
import { name as appName } from './app.json'

Amplify.configure(awsconfig)

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
  'Sending',
  'DataStore - Connection failed: {"errors":[{"message":"Validation error of type UnknownArgument: Unknown field argument owner'
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
