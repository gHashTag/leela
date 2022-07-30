import { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import { Linking } from 'react-native'
import PushNotification from 'react-native-push-notification'
import { isIos, navigate } from '../../constants'
import { PostStore } from '../../store'
import { buildReportLink } from '../linking'

export async function displayNotification(
  notification: FirebaseMessagingTypes.RemoteMessage
) {
  const dataTitle = notification.data?.title
  const dataBody = notification.data?.body

  const title = dataTitle?.replace(/(<([^>]+)>)/gi, '')
  const message = dataBody?.replace(/(<([^>]+)>)/gi, '')

  PushNotification.localNotification({
    /* Android Only Properties */
    channelId: 'reply-chanel-android', // (required) channelId, if the channel doesn't exist, notification will not trigger.
    largeIcon: require('../../../assets/icons/512.png'), // (optional) default: "ic_launcher". Use "" for no large icon.
    smallIcon: 'ic_notifee_cube', // (optional) default: "ic_notification" with fallback for "ic_launcher". Use "" for default small icon.
    color: '#1EE4EC', //icon color
    bigText: dataBody,
    vibrate: true, // (optional) default: true
    vibration: 400, // vibration length in milliseconds, ignored if vibrate=false, default: 1000
    group: 'reply', // (optional) add group to message
    ongoing: false, // (optional) set whether this is an "ongoing" notification
    priority: 'high', // (optional) set notification priority, default: high
    visibility: 'private', // (optional) set notification visibility, default: private
    ignoreInForeground: false, // (optional) if true, the notification will not be visible when the app is in the foreground (useful for parity with how iOS notifications appear). should be used in combine with `com.dieam.reactnativepushnotification.notification_foreground` setting
    //timeoutAfter: null, // (optional) Specifies a duration in milliseconds after which this notification should be canceled, if it is not already canceled, default: null
    messageId: 'google:message_id', // (optional) added as `message_id` to intent extras so opening push notification can find data stored by @react-native-firebase/messaging module.
    actions: ['Reply', 'Dismiss'], // (Android only) See the doc for notification actions to know more
    invokeApp: true, // (optional) This enable click on actions to bring back the application to foreground or stay in background, default: true

    /* iOS only properties */
    category: '', // (optional) default: empty string
    //subtitle: 'My Notification Subtitle', // (optional) smaller title below notification title

    /* iOS and Android properties */
    title: title || ' ', // (optional)
    userInfo: notification.data || {},
    message: message || ' ' // (required)
  })
}

async function cancel(id?: string) {
  if (id) {
  }
}

export async function notifeePostEvent({ type, detail }: Event) {
  const { pressAction, notification } = detail

  if (type === EventType.ACTION_PRESS) {
    switch (pressAction?.id) {
      case 'reply':
        if (
          notification?.data?.commentOwner &&
          notification?.data?.commentId &&
          detail.input
        ) {
          await cancel(notification.id)
          await PostStore.replyComment({
            text: detail?.input,
            commentOwner: notification?.data?.commentOwner,
            commentId: notification?.data?.commentId,
            postId: notification?.data?.postId
          })
        }
        break
      case 'dismiss':
        cancel(notification?.ids)
        break
    }
  } else if (type === EventType.PRESS) {
    //const postLink = await buildReportLink(notification?.data?.postId)
    //postLink && Linking.openURL(postLink)
  }
}
