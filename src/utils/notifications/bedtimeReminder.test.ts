import {
  defaultBedtimeReminder,
  getNextBedtimeTimestamp,
  loadBedtimeReminder,
  saveBedtimeReminder,
  scheduleBedtimeReminder
} from './bedtimeReminder'
import notifee from '@notifee/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const t = (key: string) => key

describe('bedtimeReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.clear?.()
  })

  it('returns default settings when nothing is saved', async () => {
    const settings = await loadBedtimeReminder()
    expect(settings).toEqual(defaultBedtimeReminder())
  })

  it('saves and loads settings', async () => {
    const settings = { enabled: true, hour: 22, minute: 30 }
    await saveBedtimeReminder(settings)
    const loaded = await loadBedtimeReminder()
    expect(loaded).toEqual(settings)
  })

  it('computes the next timestamp for a future time today', () => {
    const now = new Date('2026-08-07T10:00:00')
    const ts = getNextBedtimeTimestamp(21, 0, now)
    const next = new Date(ts)
    expect(next.getHours()).toBe(21)
    expect(next.getDate()).toBe(now.getDate())
  })

  it('rolls over to tomorrow when the time has already passed', () => {
    const now = new Date('2026-08-07T22:00:00')
    const ts = getNextBedtimeTimestamp(21, 0, now)
    const next = new Date(ts)
    expect(next.getHours()).toBe(21)
    expect(next.getDate()).toBe(now.getDate() + 1)
  })

  it('schedules a daily trigger notification when enabled', async () => {
    await scheduleBedtimeReminder(t, { enabled: true, hour: 21, minute: 0 })
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('bedtime-reminder')
    expect(notifee.createTriggerNotification).toHaveBeenCalled()
  })

  it('cancels the trigger when disabled', async () => {
    await scheduleBedtimeReminder(t, { enabled: false, hour: 21, minute: 0 })
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('bedtime-reminder')
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})
