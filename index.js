import { AppRegistry } from 'react-native'
import App from './src/AppWithProviders'
import { name as appName } from './app.json'
import notifee from '@notifee/react-native'

import messaging from '@react-native-firebase/messaging'

import { setCategories } from './src/utils/notifications/NotificationHelper'
import {
  displayNotification,
  notificationActionsHandler,
} from './src/utils/notifications'

setCategories()

messaging().setBackgroundMessageHandler(displayNotification)
messaging().onMessage(displayNotification)

notifee.onBackgroundEvent(e => notificationActionsHandler(e, true))
notifee.onForegroundEvent(e => notificationActionsHandler(e, false))

AppRegistry.registerComponent(appName, () => App)
