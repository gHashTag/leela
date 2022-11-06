import notifee, { Event, EventType } from '@notifee/react-native'
import { MessagingStore, PostStore } from '../../../store'
import { cancel, updateAndroidBadgeCount } from '../NotificationHelper'
import { updateAndroidCommentNotificationGroup } from '../replyNotification'
import { navRef } from '../../../constants'
import { getUid } from '../../../screens/helper'

export const replyActionHandler = async ({ type, detail }: Event) => {
  const { pressAction, notification, input } = detail

  const { commentOwner, commentId, postId } = notification?.data || {}

  switch (type) {
    case EventType.ACTION_PRESS:
      switch (pressAction?.id) {
        case 'reply':
          if (commentOwner && commentId && input) {
            await cancel({ notification, isInput: true })
            await PostStore.replyComment({
              text: input,
              commentOwner,
              commentId,
              postId
            })
          }
          break
      }
      break

    case EventType.PRESS:
      const reportId = postId || ''
      await notifee.decrementBadgeCount()
      updateAndroidBadgeCount({ type: 'decrement' })

      if (navRef && navRef.isReady()) {
        if (getUid()) navRef.navigate('DETAIL_POST_SCREEN', { postId: reportId })
      } else {
        const path = `/reply_detail/${reportId}`
        MessagingStore.path = path
      }

      //   if (isBg) {
      //     const branchLink = await buildReportLink(reportId, ' ')
      //     Linking.openURL(branchLink)
      //   }
      break

    case EventType.DISMISSED:
      updateAndroidBadgeCount({ type: 'decrement' })
      await notifee.decrementBadgeCount()
  }
  updateAndroidCommentNotificationGroup()
}
