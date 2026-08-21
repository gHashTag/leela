import notifee, { AuthorizationStatus } from '@notifee/react-native'
import messaging from '@react-native-firebase/messaging'

import { captureException } from '../../constants'

/*
 * Every install subscribes to these FCM topics, signed in or not.
 *
 * The token path in MessagingStore only runs on sign-in, and since onboarding
 * stopped demanding an account, most players never sign in - a push sent to
 * stored tokens reaches almost nobody. A topic reaches every install that
 * granted notification permission, which is also the permission the local
 * daily verse has silently depended on: asking here fixes both.
 *
 * One shared topic for announcements, one per-language topic so a quote of
 * the day can arrive in the reader's own language.
 */
const TOPIC = 'daily-quote'

export async function subscribeToDailyQuote(lang: string): Promise<void> {
  try {
    const settings = await notifee.requestPermission()
    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
      return
    }
    await messaging().registerDeviceForRemoteMessages()
    const own = lang === 'ru' ? 'ru' : 'en'
    const other = own === 'ru' ? 'en' : 'ru'
    await messaging().subscribeToTopic(TOPIC)
    await messaging().subscribeToTopic(`${TOPIC}-${own}`)
    // Switching the app language must not leave the player on both language
    // topics - a quote of the day would then arrive twice.
    await messaging().unsubscribeFromTopic(`${TOPIC}-${other}`)
  } catch (error) {
    captureException(error, 'subscribeToDailyQuote')
  }
}
