import notifee from '@notifee/react-native'
import messaging from '@react-native-firebase/messaging'

import { subscribeToDailyQuote } from './dailyQuotePush'

describe('subscribeToDailyQuote', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('subscribes to the shared topic and the language topic', async () => {
    await subscribeToDailyQuote('ru')
    expect(messaging().subscribeToTopic).toHaveBeenCalledWith('daily-quote')
    expect(messaging().subscribeToTopic).toHaveBeenCalledWith('daily-quote-ru')
  })

  it('falls back to the English topic for any non-Russian language', async () => {
    await subscribeToDailyQuote('hi')
    expect(messaging().subscribeToTopic).toHaveBeenCalledWith('daily-quote-en')
  })

  it('subscribes to nothing when permission is denied', async () => {
    ;(notifee.requestPermission as jest.Mock).mockResolvedValueOnce({
      authorizationStatus: 0
    })
    await subscribeToDailyQuote('en')
    expect(messaging().subscribeToTopic).not.toHaveBeenCalled()
  })
})
