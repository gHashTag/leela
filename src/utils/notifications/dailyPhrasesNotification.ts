import notifee from '@notifee/react-native'

const channelId = 'dailyPhrasesAndroid'

export const createDailyPhrasesNotificationTrigger = async () => {
  const phrases = await (
    await fetch(
      'https://leelachakra.com/resource/LeelaChakra/dailyPhrases.json'
    )
  ).json()

  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)]

  await notifee.createChannel({
    id: channelId,
    name: 'Daily phrases channel',
    badge: false
  })
  await notifee.displayNotification({
    id: 'dailyPhrases',
    title: randomPhrase,
    android: {
      channelId
    }
  })

  //1000 * 60 * 60 * 24
}
