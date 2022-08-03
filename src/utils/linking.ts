import { getStateFromPath, LinkingOptions } from '@react-navigation/native'
import { Linking } from 'react-native'
import { captureException } from '../constants'
import { RootStackParamList } from '../types'
import Branch from 'react-native-branch'
import { formatLink, subscribeDeepLinkUrl } from './linkHelpers'
import notifee from '@notifee/react-native'

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://leelagame.app.link', 'leelagame://'],

  // Пользовательская функция для получения URL-адреса,
  // которая используется для открытия приложения.
  async getInitialURL() {
    const uri = await Linking.getInitialURL()
    const { notification } = (await notifee.getInitialNotification()) || {}
    const reportId = notification?.data?.postId
    if (reportId) {
      return `leelagame://reply_detail/${reportId}`
    }
    const lastParams = await Branch.getLatestReferringParams(true)
    const normalUrl = formatLink(lastParams)
    if (normalUrl && uri) {
      return normalUrl
    }
  },
  getStateFromPath(path, config) {
    return getCustomNavState({ path, config })
  },

  // Пользовательская функция для подписки на входящие ссылки
  subscribe(listener) {
    const unsubscribe = Branch.subscribe(async ({ error, params, uri }) => {
      if (error) {
        captureException(error)
        return
      }
      if (uri) {
        const url = formatLink(params)
        subscribeDeepLinkUrl(listener, url)
        return
      }
      const { notification } = (await notifee.getInitialNotification()) || {}
      const reportId = notification?.data?.postId

      if (reportId) {
        subscribeDeepLinkUrl(listener, `leelagame://reply_detail/${reportId}`)

        return
      }
    })

    return unsubscribe
  },
  config: {
    screens: {
      // MAIN: {
      //   screens: {
      //     TAB_BOTTOM_2: 'posts',
      //   }
      // },
      DETAIL_POST_SCREEN: {
        path: 'reply_detail/:postId'
      },
      WELCOME_SCREEN: '*'
    }
  }
}

// Custom state
interface getCustomNavStateT {
  path: string
  config?: any
}

const getCustomNavState = ({ path, config }: getCustomNavStateT) => {
  if (path.includes('reply_detail')) {
    return getDetailPostState({ path })
  }
  return getStateFromPath(path, config)
}

const getDetailPostState = ({ path, config }: getCustomNavStateT) => {
  const splitedPath = path.split('/')
  const postId = splitedPath[splitedPath.length - 1]

  return {
    routes: [
      {
        name: 'MAIN',
        state: {
          routes: [
            {
              name: 'TAB_BOTTOM_1'
            }
          ]
        }
      },
      {
        name: 'DETAIL_POST_SCREEN',
        params: {
          postId
        },
        path
      }
    ]
  }
}
