import notifee from '@notifee/react-native'
import messaging from '@react-native-firebase/messaging'
import { AppRegistry } from 'react-native'
import { I18nManager } from 'react-native'

import { name as appName } from './app.json'
import App from './src/AppWithProviders'
import { captureException } from './src/constants'
import {
  displayNotification,
  notificationActionsHandler
} from './src/utils/notifications'
import { setCategories } from './src/utils/notifications/NotificationHelper'
import './src/i18n'

try {
  I18nManager.allowRTL(false)
} catch (error) {
  captureException(error)
}

setCategories()

messaging().setBackgroundMessageHandler(displayNotification)
messaging().onMessage(displayNotification)

notifee.onBackgroundEvent((e) => notificationActionsHandler(e, true))
notifee.onForegroundEvent((e) => notificationActionsHandler(e, false))

AppRegistry.registerComponent(appName, () => App)
