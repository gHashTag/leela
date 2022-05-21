import { utils } from '@react-native-firebase/app'
import dynamicLinks from '@react-native-firebase/dynamic-links'
import { LinkingOptions } from '@react-navigation/native'
import { Linking } from 'react-native'
import { captureException } from '../constants'
import { RootStackParamList, RootTabParamList } from '../types'

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['leela://', 'https://leela.page.link'],

  // Пользовательская функция для получения URL-адреса,
  // которая используется для открытия приложения.
  async getInitialURL() {
    // вам нужно будет получить исходный URL-адрес
    // чтобы получить исходный URL для динамических ссылок:
    const { isAvailable } = utils().playServicesAvailability

    if (isAvailable) {
      const initialLink = await dynamicLinks().getInitialLink()

      if (initialLink) {
        return initialLink.url
      }
    }

    // В качестве запасного варианта вы можете выполнить
    // обработку глубоких ссылок по умолчанию.
    const url = await Linking.getInitialURL()

    return url
  },

  // Пользовательская функция для подписки на входящие ссылки
  subscribe(listener) {
    // Слушайте входящие ссылки из Firebase Dynamic Links
    const unsubscribeFirebase = dynamicLinks().onLink(({ url }) => {
      listener(url)
    })

    // Прослушивание входящих ссылок из глубинных ссылок
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      listener(url)
    })

    return () => {
      // Очистите прослушиватели событий
      unsubscribeFirebase()
      linkingSubscription.remove()
    }
  },
  config: {
    screens: {
      MAIN: {
        screens: {
          TAB_BOTTOM_2: 'posts',
          TAB_BOTTOM_4: 'profile'
        }
      },
      DETAIL_POST_SCREEN: {
        path: 'detail_post/:postId'
      },
      WELCOME_SCREEN: '*'
    }
  }
}

export async function buildLink(path: string) {
  const link = await dynamicLinks()
    .buildLink({
      link: `https://leela.page.link${path}`,
      // domainUriPrefix is created in your Firebase console
      domainUriPrefix: 'https://leela.page.link'
      // optional setup which updates Firebase analytics campaign
      // "banner". This also needs setting up before hand
    })
    .catch(captureException)
  console.log(link)
  return link
}
