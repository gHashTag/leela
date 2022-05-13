import { Dimensions, Linking } from 'react-native'
// import * as Sentry from '@sentry/react-native'
import { createNavigationContainerRef } from '@react-navigation/native'

export const navRef = createNavigationContainerRef()

export const navigate = (name: string, params?: any) => {
  if (navRef.isReady()) {
    navRef.navigate(name, params)
  }
}

export const captureException = error => {
  if (!error) {
    console.log('%c captureException called with messing or incorrect arguments', 'background: #555; color: yellow')
    return
  }
  console.error(error)
  // Sentry.captureException(error)
}

export const win = Dimensions.get('window')
export const W = win.width
export const H = win.height
export const imgH = Math.round((W * 9) / 16)

export const openUrl = async (url: string) => {
  await Linking.openURL(url)
}

export const Device = {
  select(variants: {
    mobile300: {
      top: number
    }
    mobile315: {
      top: number
    }
    iphone5: {
      top: number
    }
    mobile342: {
      top: number
    }
    mobile360: {
      top: number
    }
    mobile375: {
      top: number
    }
    mobile400: {
      top: number
    }
    mobile410: {
      top: number
    }
    mobile415: {
      top: number
    }
    mobile480: {
      top?: number
    }
    mi5?: {
      top: number
    }
    iphone678?: {
      top: number
    }
    googlePixel?: {
      top: number
    }
    redmiNote5?: {
      top: number
    }
  }) {
    if (W >= 300 && W <= 314) {
      return variants.mobile300 || {}
    }
    if (W >= 315 && W <= 341) {
      return variants.iphone5 || {}
    }
    if (W >= 342 && W <= 359) {
      return variants.mobile342 || {}
    }
    if (W >= 360 && W <= 374) {
      return variants.mi5 || {}
    }
    if (W >= 375 && W <= 399) {
      return variants.iphone678 || {}
    }
    if (W >= 400 && W <= 409) {
      return variants.mobile400 || {}
    }
    if (W >= 410 && W <= 414) {
      return variants.googlePixel || {}
    }
    if (W >= 415 && W <= 434) {
      return variants.mobile415 || {}
    }
    if (W >= 435 && W <= 480) {
      return variants.redmiNote5 || {}
    }
  }
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

export const defUrl = 'https://s3.eu-central-1.wasabisys.com/database999/LeelaChakra/Mantra/mantra.json'

export const ENTITLEMENT_ID = 'Pro'
