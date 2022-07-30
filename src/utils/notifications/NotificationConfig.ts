import PushNotification from 'react-native-push-notification'
import PushNotificationIOS from '@react-native-community/push-notification-ios'

export async function initNotifications() {
  PushNotification.configure({
    // (required) Called when a remote is received or opened, or local notification is opened
    onNotification: function (notification) {
      console.log('NOTIFICATION:', notification)

      // (required) Called when a remote is received or opened, or local notification is opened
      notification.finish(PushNotificationIOS.FetchResult.NoData)
    },

    onAction: function (notification) {
      console.log('ACTION:', notification?.action)
      console.log('NOTIFICATION:', notification)
    },

    onRegistrationError: function (err) {
      console.error(err.message, err)
    },
    permissions: {
      alert: true,
      badge: true,
      sound: true
    },

    popInitialNotification: true,

    requestPermissions: false
  })
  PushNotificationIOS.setNotificationCategories([
    {
      id: 'reply',
      actions: [
        {
          id: 'dismiss',
          title: 'Dismiss',
          options: { foreground: true, destructive: true }
        },
        {
          id: 'reply',
          title: 'Your comment',
          options: { foreground: true },
          textInput: { buttonTitle: 'Reply' }
        }
      ]
    }
  ])
  PushNotification.createChannel(
    {
      channelId: 'reply-chanel-android', // (required)
      channelName: 'Reply channel', // (required)
      playSound: false, // (optional) default: true
      vibrate: true // (optional) default: true. Creates the default vibration pattern if true.
    },
    created => console.log(`createChannel returned '${created}'`)
  )
}
