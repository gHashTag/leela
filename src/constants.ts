import { Dimensions, Linking } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { createNavigationContainerRef } from '@react-navigation/native'
import { ButtonsModalT } from './types'

export const navRef = createNavigationContainerRef<any>()

export const navigate = (name: string, params?: any) => {
  if (navRef.isReady()) {
    navRef.navigate(name, params)
  }
}

export function OpenExitModal() {
  if (navRef.isReady()) {
    navRef.navigate('EXIT_MODAL')
  }
}

export function OpenReplyModal(modalButtons: ButtonsModalT[]) {
  if (navRef.isReady()) {
    navRef.navigate('REPLY_MODAL', { buttons: modalButtons })
  }
}

export const captureException = (error: any) => {
  if (!error) {
    console.log(
      '%c captureException called with messing or incorrect arguments',
      'background: #555; color: yellow'
    )
    return
  }
  console.error(error)
  Sentry.captureException(error)
}

export const win = Dimensions.get('window')
export const W = win.width
export const H = win.height
export const imgH = Math.round((W * 9) / 16)

export const openUrl = async (url: string) => {
  await Linking.openURL(url)
}

export const goBack = navigation => () => navigation.goBack()

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

export const revenuecat = 'BeIMIIfptWXlouosYudFEWQDkwDvJUzv'

export const defUrl =
  'https://s3.eu-central-1.wasabisys.com/database999/LeelaChakra/Mantra/mantra.json'

export const ENTITLEMENT_ID = 'Pro'

export const timeStampType = [
  {
    now: 'now0',
    today: 'today0',
    yesterday: 'yday0',
    days: 'd0',
    month: 'm0',
    year: 'y0'
  },
  {
    now: 'now1',
    today: 'today1',
    yesterday: 'yday1',
    days: 'd1',
    month: 'm1',
    year: 'y1'
  }
]
