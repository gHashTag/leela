import { AppRegistry } from 'react-native'
import App from './src/AppWithProviders'
import { name as appName } from './app.json'
import notifee from '@notifee/react-native'

import messaging from '@react-native-firebase/messaging'

import displayNotification from './src/utils/notifications/DisplayNotification'
import {
  notificationPostEvent,
  setCategories
} from './src/utils/notifications/NotificationHelper'

setCategories()

messaging().setBackgroundMessageHandler(displayNotification)
messaging().onMessage(displayNotification)

notifee.onBackgroundEvent(notificationPostEvent(true))
notifee.onForegroundEvent(notificationPostEvent(false))

AppRegistry.registerComponent(appName, () => App)
