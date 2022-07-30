import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

import messaging from '@react-native-firebase/messaging'

import { displayNotification } from './src/utils/notifications/Notification'
import { initNotifications } from './src/utils/notifications/NotificationConfig'

initNotifications()
messaging().setBackgroundMessageHandler(displayNotification)
messaging().onMessage(displayNotification)

AppRegistry.registerComponent(appName, () => App)
