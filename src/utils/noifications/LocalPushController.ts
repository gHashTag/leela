import PushNotification, { Importance } from 'react-native-push-notification'

PushNotification.configure({
  // (required) Called when a remote or local notification is opened or received
  onNotification: function (notification) {
    LocalNotification(notification)
  },

  popInitialNotification: true,
  requestPermissions: true
})

PushNotification.createChannel(
  {
    channelId: 'default-channel-id', // (required)
    channelName: 'Default channel', // (required)
    channelDescription: 'A default channel', // (optional) default: undefined.
    soundName: 'default', // (optional) See `soundName` parameter of `localNotification` function
    importance: Importance.HIGH, // (optional) default: Importance.HIGH. Int value of the Android notification importance
    vibrate: true // (optional) default: true. Creates the default vibration patten if true.
  },
  created => `createChannel 'default-channel-id' returned '${created}'` // (optional) callback returns whether the channel was created, false means it already existed.
)

export const LocalNotification = notification => {
  PushNotification.localNotification({
    channelId: 'default-channel-id',
    ticker: 'My Notification Ticker',
    bigText: notification.body,
    title: notification.title,
    // bigText: notification.data['pinpoint.notification.body'],
    // title: notification.data['pinpoint.notification.title'],
    largeIconUrl: 'https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/logo.png', // (optional) default: undefined
    autoCancel: true,
    message: 'Expand me to see more',
    vibrate: true,
    vibration: 300,
    playSound: true,
    soundName: 'default',
    actions: '["Yes", "No"]'
  })
}
