import notifee, { AndroidBadgeIconType } from '@notifee/react-native'
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import { nanoid } from 'nanoid/non-secure'
import { isIos } from '../../constants'
import { updateAndroidBadgeCount } from './NotificationHelper'

export default async function displayNotification(
  notification: FirebaseMessagingTypes.RemoteMessage
) {
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    badge: true
  })
  updateAndroidBadgeCount({ type: 'increment' })
  notifee.incrementBadgeCount()
  await notifee.displayNotification({
    title: isIos
      ? notification.data?.title.replace(/(<([^>]+)>)/gi, '')
      : notification.data?.title,
    body: isIos
      ? notification.data?.body.replace(/(<([^>]+)>)/gi, '')
      : notification.data?.body,
    data: notification.data,
    id: nanoid(10),
    android: {
      channelId,
      smallIcon: 'ic_notifee_cube', // optional, defaults to 'ic_launcher'.
      color: '#1EE4EC',
      largeIcon: require('../../../assets/icons/512.png'),
      badgeIconType: AndroidBadgeIconType.SMALL,
      actions: [
        {
          title: 'Reply',
          pressAction: {
            id: 'reply'
          },
          input: {
            placeholder: 'Your comment'
          }
        },
        {
          title: '<p style="color: #f44336;">Dismiss</p>',
          pressAction: {
            id: 'dismiss'
          }
        }
      ],
      pressAction: {
        id: 'default'
      },
      groupSummary: true,
      groupId: 'new-comment'
    },
    ios: {
      categoryId: 'reply'
    }
  })
}
