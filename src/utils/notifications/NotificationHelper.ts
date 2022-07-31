import notifee, {
  AndroidBadgeIconType,
  Event,
  EventType,
  Notification
} from '@notifee/react-native'
import { PostStore } from '../../store'
import Branch from 'react-native-branch'
import { Linking } from 'react-native'
import { buildReportLink } from '../linkHelpers'

export const postNotificationEvent =
  (isBackgroundEvent: boolean) =>
  async ({ type, detail }: Event) => {
    const { pressAction, notification } = detail

    switch (type) {
      case EventType.ACTION_PRESS:
        switch (pressAction?.id) {
          case 'reply':
            if (
              notification?.data?.commentOwner &&
              notification?.data?.commentId &&
              detail.input
            ) {
              await cancel({ notification, reply: true })
              await PostStore.replyComment({
                text: detail?.input,
                commentOwner: notification?.data?.commentOwner,
                commentId: notification?.data?.commentId,
                postId: notification?.data?.postId
              })
            }
            break
          case 'dismiss':
            cancel({ notification, completeDismiss: true })
            break
          case 'completeDismiss':
            cancel({ notification })
            break
        }
        break
      case EventType.PRESS:
        const reportId = notification?.data?.postId || ''
        await notifee.decrementBadgeCount()
        if (isBackgroundEvent) {
          const branchLink = await buildReportLink(reportId, ' ')
          console.log('🚀 - branchLink', branchLink)
          Linking.openURL(branchLink)
        } else {
          Branch.openURL(`leelagame://reply_detail/${reportId}`)
        }
        break
      case EventType.DISMISSED:
        await notifee.decrementBadgeCount()
    }
  }

async function cancel({ notification, reply, completeDismiss }: cancelT) {
  const { id, data } = notification || {}

  if (id) {
    if (reply) {
      await notifee.decrementBadgeCount()
      const channelId = await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        badge: true
      })

      await notifee.displayNotification({
        id,
        title: 'Done',
        body: 'Sent successfully!',
        data,
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
                id: 'completeDismiss'
              }
            }
          ],
          pressAction: {
            id: 'default'
          },
          groupSummary: true,
          groupId: 'new-comment'
        }
      })
    } else {
      await notifee.cancelDisplayedNotification(id)
      await notifee.cancelNotification(id)
    }
    if (completeDismiss) {
      await notifee.decrementBadgeCount()
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

interface cancelT {
  notification?: Notification
  reply?: boolean
  completeDismiss?: boolean
}
