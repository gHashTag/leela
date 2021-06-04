import { useEffect } from 'react'
import PushNotification, { Importance } from 'react-native-push-notification'
import { LocalNotification } from './LocalPushController'

const RemotePushController = () => {
  useEffect(() => {
    PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister: function (token) {
        //console.log('TOKEN:', token)
      },

      // (required) Called when a remote or local notification is opened or received
      onNotification: function (notification) {
        // console.log('REMOTE NOTIFICATION 3==>', notification)
        LocalNotification(notification)
        // process the notification here
      },
      // Android only: GCM or FCM Sender ID
      senderID: '244146240811',
      popInitialNotification: true,
      requestPermissions: true
    })

    const createDefaultChannels = () => {
      PushNotification.createChannel(
        {
          channelId: 'default-channel-id', // (required)
          channelName: 'Default channel', // (required)
          channelDescription: 'A default channel', // (optional) default: undefined.
          soundName: 'default', // (optional) See `soundName` parameter of `localNotification` function
          importance: Importance.HIGH, // (optional) default: Importance.HIGH. Int value of the Android notification importance
          vibrate: true // (optional) default: true. Creates the default vibration patten if true.
        },
        created => created
        // created => console.log(`createChannel 'default-channel-id' returned '${created}'`) // (optional) callback returns whether the channel was created, false means it already existed.
      )
    }

    createDefaultChannels()
  }, [])

  return null
}

export default RemotePushController
