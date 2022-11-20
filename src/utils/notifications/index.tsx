import { Event } from '@notifee/react-native'
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging'

import { replyActionHandler } from './actionHandlers'
import { replyNotification } from './replyNotification'

export async function displayNotification(
  notification: FirebaseMessagingTypes.RemoteMessage,
) {
  switch (notification.data?.notificationType) {
    case 'newComment':
      replyNotification(notification)
      break
  }
}

export async function notificationActionsHandler(event: Event, isBackground: boolean) {
  const notificationType = event.detail.notification?.data?.notificationType
  switch (notificationType) {
    case 'newComment':
      replyActionHandler(event)
      break
  }
}

export * from './dailyPhrasesNotification'
