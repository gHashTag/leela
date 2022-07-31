import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'
import notifee from '@notifee/react-native'

import messaging from '@react-native-firebase/messaging'

import displayNotification from './src/utils/notifications/DisplayNotification'
import {
  postNotificationEvent,
  setCategories
} from './src/utils/notifications/NotificationHelper'

setCategories()

messaging().setBackgroundMessageHandler(displayNotification)
messaging().onMessage(displayNotification)

notifee.onBackgroundEvent(postNotificationEvent(true))
notifee.onForegroundEvent(postNotificationEvent(false))

AppRegistry.registerComponent(appName, () => App)
