import { createNavigationContainerRef } from '@react-navigation/native'
import * as Sentry from '@sentry/react-native'
import { Alert, Dimensions, Linking, Platform } from 'react-native'
import i18next from 'src/i18n'

import { ButtonsModalT } from './types'

export const navRef = createNavigationContainerRef<any>()

export const navigate = (name: string, params?: any) => {
  if (navRef.isReady()) {
    navRef.navigate(name, params)
  }
}

export function OpenNetworkModal() {
  if (navRef.isReady()) {
    navRef.navigate('NETWORK_MODAL')
  }
}

export function OpenUpdateVersionModal() {
  if (navRef.isReady()) {
    navRef.navigate('UPDATE_VERSION_MODAL')
  }
}

export function OpenExitModal() {
  if (navRef.isReady()) {
    navRef.navigate('EXIT_MODAL')
  }
}

interface VideoModalT {
  uri: string
  poster: string
}

export function OpenVideoModal({ uri, poster }: VideoModalT) {
  if (navRef.isReady()) {
    navRef.navigate('VIDEO_SCREEN', { uri, poster })
  }
}

export function OpenPlanReportModal(plan: number) {
  if (navRef.isReady()) {
    navRef.navigate('PLAN_REPORT_MODAL', { plan })
  }
}

export function OpenActionsModal(modalButtons: ButtonsModalT[]) {
  if (navRef.isReady()) {
    navRef.navigate('REPLY_MODAL', { buttons: modalButtons })
  }
}

export const banAlert = () => {
  Alert.alert(i18next.t('online-part.youBanned'), i18next.t('online-part.banText'), [
    { text: 'OK', onPress: () => navigate('WELCOME_SCREEN') },
  ])
}
export const accountHasBanAlert = () => {
  Alert.alert(i18next.t('online-part.accountBanned'), undefined, [{ text: 'OK' }])
}

export const captureException = (error: any) => {
  if (!error) {
    console.log(
      '%c captureException called with messing or incorrect arguments',
      'background: #555; color: yellow',
    )
    return
  }
  console.error(`My Error: ${error}`)
  if (!__DEV__) {
    Sentry.captureException(error)
  }
}

export const win = Dimensions.get('window')
export const W = win.width
export const H = win.height
export const imgH = Math.round((W * 9) / 16)
export const isIos = Platform.OS === 'ios'

export const openUrl = async (url: string) => {
  await Linking.openURL(url)
}

export const goBack = () => {
  if (navRef.isReady()) {
    navRef.goBack()
  }
}
//@ts-ignore
export const goHome = navigation => () => navigation.popToTop()()

export const primary = '#50E3C2'
export const secondary = '#ff06f4'
export const gray = '#949494'
export const white = '#ffffff'
export const black = '#1c1c1c'
export const dimGray = '#707070'
export const lightGray = '#D1CDCD'
export const classicRose = '#FDBEEA'
export const mustard = '#F3DE50'
export const fuchsia = '#FF06F4'
export const trueBlue = '#007ACD'
export const paleBlue = '#BEFCE5'
export const brightTurquoise = '#1EE4EC'
export const RED = '#FC2847'
export const orange = '#FFB700'

export const revenuecat = 'BeIMIIfptWXlouosYudFEWQDkwDvJUzv'

export const defUrl = 'https://leelachakra.com/resource/LeelaChakra/Mantra/mantra.json'

export const ENTITLEMENT_ID = 'Pro'
