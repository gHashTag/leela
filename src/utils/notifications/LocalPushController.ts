import notifee, { AndroidBadgeIconType, Event, EventType } from '@notifee/react-native'
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import { nanoid } from 'nanoid/non-secure'
import { Platform } from 'react-native'
import { PostStore } from '../../store'

export async function displayNotification(
  notification: FirebaseMessagingTypes.RemoteMessage
) {
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    badge: true
  })

  await notifee.displayNotification({
    title:
      Platform.OS === 'ios'
        ? notification.data?.title.replace(/(<([^>]+)>)/gi, '')
        : notification.data?.title,
    body:
      Platform.OS === 'ios'
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
      groupSummary: true,
      groupId: 'new-comment'
    },
    ios: {
      categoryId: 'reply'
    }
  })
}

async function cancel(id?: string, reply?: boolean) {
  if (id) {
    await notifee.cancelDisplayedNotification(id)
    await notifee.cancelNotification(id)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      badge: true
    })

    await notifee.displayNotification({
      id,
      title: 'Done',
      body: 'Sent successfully!',
      android: {
        channelId,
        smallIcon: 'ic_notifee_cube',
        color: '#1EE4EC',
        largeIcon: require('../../../assets/icons/512.png'),
        badgeIconType: AndroidBadgeIconType.SMALL,
        actions: [
          {
            title: '<p style="color: #f44336;">Dismiss</p>',
            pressAction: {
              id: 'dismiss'
            }
          }
        ],
        groupSummary: true,
        groupId: 'new-comment'
      }
    })
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
          await cancel(notification.id, true)
          await PostStore.replyComment({
            text: detail?.input,
            commentOwner: notification?.data?.commentOwner,
            commentId: notification?.data?.commentId
          })
        }
        break
      case 'dismiss':
        cancel(notification?.id)
        break
    }
  }
}

export async function setCategories() {
  await notifee.setNotificationCategories([
    {
      id: 'reply',
      actions: [
        {
          id: 'dismiss',
          title: 'Dismiss'
        },
        {
          id: 'reply',
          title: 'Reply',
          input: {
            placeholderText: 'Your comment'
          }
        }
      ]
    }
  ])
}
