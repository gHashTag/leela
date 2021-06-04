import { Dimensions, Linking } from 'react-native'

export const win = Dimensions.get('window')
export const W = win.width
export const H = win.height
export const imgH = Math.round((W * 9) / 16)

export const openUrl = async (url: string) => {
  await Linking.openURL(url)
}

export const Device = {
  select(variants) {
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

export const onScreen = (screen, navigation, obj) => () => {
  navigation.navigate(screen, obj)
}

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

export const defUrl = 'https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/Mantra/mantra.json'

export const ENTITLEMENT_ID = 'Pro'
