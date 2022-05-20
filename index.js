import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

import messaging from '@react-native-firebase/messaging'
import notifee from '@notifee/react-native'
import {
  displayNotification,
  notifeePostEvent
} from './src/utils/notifications/LocalPushController'

messaging().setBackgroundMessageHandler(async payload => {
  displayNotification(payload)
})
messaging().onMessage(async payload => {
  displayNotification(payload)
})
notifee.onBackgroundEvent(async event => {
  notifeePostEvent(event)
})
notifee.onForegroundEvent(async event => {
  notifeePostEvent(event)
})

AppRegistry.registerComponent(appName, () => App)
