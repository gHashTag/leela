import notifee, {
  RepeatFrequency,
  TimestampTrigger,
  TriggerType
} from '@notifee/react-native'
import { TFunction } from 'i18next'

import { captureException } from '../../constants'
import { getVerseOfTheDay } from '../dailyVerse'

const CHANNEL_ID = 'dailyVerse'
const NOTIFICATION_ID = 'dailyVerse'
const HOUR = 9
const MINUTE = 0

export function getNextDailyVerseTimestamp(date = new Date()): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), HOUR, MINUTE, 0, 0)
  if (target.getTime() <= date.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

export async function scheduleDailyVerseNotification(t: TFunction): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: t('dailyVerse.notificationChannelName'),
      badge: false
    })

    const verse = getVerseOfTheDay(t)
    if (!verse) return

    await notifee.cancelTriggerNotification(NOTIFICATION_ID)

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: getNextDailyVerseTimestamp(),
      repeatFrequency: RepeatFrequency.DAILY
    }

    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: t('dailyVerse.notificationTitle'),
        body: verse.quote,
        data: {
          type: 'dailyVerse',
          source: verse.source
        },
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_notifee_cube',
          color: '#1EE4EC',
          pressAction: {
            id: 'default'
          }
        }
      },
      trigger
    )
  } catch (error) {
    captureException(error as Error, 'scheduleDailyVerseNotification')
  }
}

export async function cancelDailyVerseNotification(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(NOTIFICATION_ID)
  } catch (error) {
    captureException(error as Error, 'cancelDailyVerseNotification')
  }
}
