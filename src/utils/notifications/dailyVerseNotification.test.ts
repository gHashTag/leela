import notifee from '@notifee/react-native'

import {
  getNextDailyVerseTimestamp,
  scheduleDailyVerseNotification
} from './dailyVerseNotification'

describe('dailyVerseNotification', () => {
  const mockT = ((key: string, options?: { returnObjects?: boolean }) => {
    if (key === 'dailyVerse.verses' && options?.returnObjects) {
      return [
        { quote: 'Test quote', source: 'Test source', reflection: 'Test reflection' }
      ]
    }
    if (key === 'dailyVerse.notificationTitle') return 'Daily Verse'
    if (key === 'dailyVerse.notificationChannelName') return 'Daily reminders'
    return key
  }) as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schedules the next notification for tomorrow when current time is past 9:00', () => {
    const now = new Date(2026, 0, 1, 10, 0, 0)
    const next = getNextDailyVerseTimestamp(now)
    const expected = new Date(2026, 0, 2, 9, 0, 0).getTime()
    expect(next).toBe(expected)
  })

  it('schedules the next notification for today when current time is before 9:00', () => {
    const now = new Date(2026, 0, 1, 7, 0, 0)
    const next = getNextDailyVerseTimestamp(now)
    const expected = new Date(2026, 0, 1, 9, 0, 0).getTime()
    expect(next).toBe(expected)
  })

  it('creates a daily repeating trigger notification', async () => {
    await scheduleDailyVerseNotification(mockT)

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dailyVerse',
        name: 'Daily reminders'
      })
    )
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('dailyVerse')
    expect(notifee.createTriggerNotification).toHaveBeenCalled()

    const [, trigger] = (notifee.createTriggerNotification as jest.Mock).mock.calls[0]
    expect(trigger).toMatchObject({
      type: 0,
      repeatFrequency: 1
    })
  })
})
