import AsyncStorage from '@react-native-async-storage/async-storage'
import notifee, {
  RepeatFrequency,
  TimestampTrigger,
  TriggerType
} from '@notifee/react-native'
import { TFunction } from 'i18next'

import { captureException } from '../../constants'

export const BEDTIME_REMINDER_ID = 'bedtime-reminder'
const STORAGE_KEY = '@bedtimeReminder'
const DEFAULT_HOUR = 21
const DEFAULT_MINUTE = 0

export interface BedtimeReminderSettings {
  enabled: boolean
  hour: number
  minute: number
}

export const defaultBedtimeReminder = (): BedtimeReminderSettings => ({
  enabled: false,
  hour: DEFAULT_HOUR,
  minute: DEFAULT_MINUTE
})

export async function loadBedtimeReminder(): Promise<BedtimeReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultBedtimeReminder()
    const parsed = JSON.parse(raw) as Partial<BedtimeReminderSettings>
    return {
      enabled: !!parsed.enabled,
      hour: typeof parsed.hour === 'number' ? parsed.hour : DEFAULT_HOUR,
      minute: typeof parsed.minute === 'number' ? parsed.minute : DEFAULT_MINUTE
    }
  } catch (error) {
    captureException(error, 'loadBedtimeReminder')
    return defaultBedtimeReminder()
  }
}

export async function saveBedtimeReminder(
  settings: BedtimeReminderSettings
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    captureException(error, 'saveBedtimeReminder')
  }
}

export function getNextBedtimeTimestamp(
  hour: number,
  minute: number,
  referenceDate = new Date()
): number {
  const next = new Date(referenceDate)
  next.setHours(hour, minute, 0, 0)

  if (next.getTime() <= referenceDate.getTime()) {
    next.setDate(next.getDate() + 1)
  }

  return next.getTime()
}

export async function scheduleBedtimeReminder(
  t: TFunction,
  settings: BedtimeReminderSettings
): Promise<void> {
  await notifee.createChannel({
    id: BEDTIME_REMINDER_ID,
    name: t('bedtimeReminder.notificationChannelName'),
    badge: false
  })

  await notifee.cancelTriggerNotification(BEDTIME_REMINDER_ID)

  if (!settings.enabled) return

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: getNextBedtimeTimestamp(settings.hour, settings.minute),
    repeatFrequency: RepeatFrequency.DAILY
  }

  await notifee.createTriggerNotification(
    {
      id: BEDTIME_REMINDER_ID,
      title: t('bedtimeReminder.notificationTitle'),
      body: t('bedtimeReminder.notificationBody'),
      android: {
        channelId: BEDTIME_REMINDER_ID,
        pressAction: { id: 'default' }
      }
    },
    trigger
  )
}
