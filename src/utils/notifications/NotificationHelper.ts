import notifee, { DisplayedNotification, Notification } from '@notifee/react-native'
import { BadgeAndroidStore } from '../../store'
// @ts-ignore
import BadgeAndroid from 'react-native-android-badge'

export async function setCategories() {
  await notifee.setNotificationCategories([
    {
      id: 'reply',
      actions: [
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

export const updateAndroidBadgeCount = async ({ type, value }: setAndroidBadgeCountT) => {
  const previous = BadgeAndroidStore.count

  switch (type) {
    case 'increment':
      BadgeAndroidStore.count = previous + 1
      BadgeAndroid?.setBadge(previous + 1)
      break
    case 'decrement':
      if (previous > 0) {
        BadgeAndroidStore.count = previous - 1
        BadgeAndroid?.setBadge(previous - 1)
      }
      break
    case 'set':
      BadgeAndroidStore.count = value || 0
      BadgeAndroid?.setBadge(value || 0)
      break
    case 'clear':
      BadgeAndroidStore.count = 0
      BadgeAndroid?.setBadge(0)
      break
  }
}

export async function cancel({ notification, isInput }: cancelT) {
  const { id, data } = notification || {}

  if (id) {
    if (isInput) {
      const channelId = await notifee.createChannel({
        id: 'cancel',
        name: 'Cancel Channel'
      })

      await notifee.displayNotification({
        id,
        title: ' ',
        body: ' ',
        data,
        android: {
          channelId,
          smallIcon: 'ic_notifee_cube',
          color: '#1EE4EC',
          groupId: 'new-comment'
        }
      })
    }

    await notifee.cancelNotification(id)
    updateAndroidBadgeCount({ type: 'decrement' })
    await notifee.decrementBadgeCount()
  }
}

interface cancelT {
  notification?: Notification
  isInput?: boolean
}

export const getNotificationsByGroupAndroid = (
  notifications: DisplayedNotification[],
  groupName: string
) => {
  return notifications.filter(
    a =>
      !a.notification.android?.groupSummary &&
      a.notification.android?.groupId === groupName
  )
}

interface setAndroidBadgeCountT {
  type: 'increment' | 'decrement' | 'set' | 'clear'
  value?: number
}
