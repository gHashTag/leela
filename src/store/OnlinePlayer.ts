import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'
import { makeAutoObservable } from 'mobx'
import * as Keychain from 'react-native-keychain'
import i18next from 'src/i18n'

import { upStepOnline } from './helper'
import { delTokenOnSignOut } from './MessagingStore'

import { captureException, navigate } from '../constants'
import {
  getFireBaseRef,
  getIMG,
  getImagePicker,
  getProfile,
  resetHistory,
  resetPlayer,
  updatePlan,
  uploadImg,
} from '../screens/helper'
import { HistoryT, status } from '../types'
import { DiceStore, actionsDice } from './'

const initProfile = {
  firstName: '',
  lastName: '',
  email: '',
  intention: '',
}

const initHistory = () => [
  {
    createDate: Date.now(),
    plan: 68,
    count: 0,
    status: 'start',
  },
]

export const OnlinePlayer = makeAutoObservable<Istore>({
  store: {
    start: false,
    finish: false,
    stepTime: 0,
    timeText: ' ',
    canGo: false,
    plan: 68,
    // addons
    firstGame: false,
    loadingProf: true,
    history: initHistory(),
    isReported: true,
    avatar: '',
    profile: initProfile,
    // poster
    poster: {
      imgUrl: 'https://leelachakra.com/resource/LeelaChakra/poster.JPG',
      eventUrl: '',
      buttonColor: '#1c1c1c',
    },
    isPosterLoading: false,
  },
  async resetGame(): Promise<void> {
    try {
      OnlinePlayer.store = {
        ...OnlinePlayer.store,
        start: false,
        finish: false,
        plan: 68,
        history: initHistory(),
      }
      await resetPlayer()
      await resetHistory()
      await updatePlan(68)
    } catch (err) {
      captureException(err)
    }
  },
  async SignOut(): Promise<void> {
    try {
      const userUid = auth().currentUser?.uid
      await getFireBaseRef(`/online/${userUid}`).set(false)
      await delTokenOnSignOut()
      OnlinePlayer.store = {
        ...OnlinePlayer.store,
        profile: initProfile,
        avatar: '',
        start: false,
        finish: false,
        plan: 68,
        history: initHistory(),
        canGo: false,
        stepTime: 0,
        timeText: ' ',
        loadingProf: true,
      }
      actionsDice.resetPlayer()
      await Keychain.resetInternetCredentials('auth')
      await auth().signOut()
      navigate('WELCOME_SCREEN')
    } catch (err) {
      captureException(err)
    }
  },
  async SignOutToOffline(): Promise<void> {
    try {
      OnlinePlayer.store = {
        ...OnlinePlayer.store,
        profile: initProfile,
        avatar: '',
        start: false,
        finish: false,
        plan: 68,
        history: initHistory(),
        canGo: false,
        stepTime: 0,
        timeText: ' ',
        loadingProf: true,
      }
      actionsDice.resetPlayer()
      await auth().signOut()
    } catch (err) {
      captureException(err)
    }
  },
  async getProfile(): Promise<void> {
    try {
      OnlinePlayer.store.loadingProf = true
      const curProf = await getProfile()
      if (curProf) {
        OnlinePlayer.store = {
          ...OnlinePlayer.store,
          plan: curProf.plan,
          start: curProf.start,
          finish: curProf.finish,
          firstGame: curProf.firstGame,
          profile: {
            firstName: curProf.firstName,
            lastName: curProf.lastName,
            email: curProf.email,
            intention: curProf.intention || '',
          },
          isReported: curProf.isReported,
          flagEmoji: curProf.flagEmoji,
          stepTime: curProf.lastStepTime,
          canGo: Date.now() - curProf.lastStepTime >= 86400000,
          status: curProf.status,
          history: curProf.history
            .sort((a, b) => b.createDate - a.createDate)
            .slice(0, 30),
        }
        if (curProf.plan === 68 && !curProf.finish) {
          actionsDice.setMessage(i18next.t('sixToBegin'))
        } else {
          actionsDice.setMessage(' ')
        }
        OnlinePlayer.store.avatar = await getIMG(curProf.avatar)
        DiceStore.startGame = curProf.start
      }
      OnlinePlayer.store.loadingProf = false
    } catch (error) {
      captureException(error)
    }
  },
  async uploadImage(): Promise<void> {
    try {
      const image = await getImagePicker()
      if (image) {
        try {
          const fileName = await uploadImg(image)
          const prevImgUrl = auth().currentUser?.photoURL
          if (prevImgUrl) {
            await storage().ref(prevImgUrl).delete()
          }
          await auth().currentUser?.updateProfile({
            photoURL: fileName,
          })
          await firestore().collection('Profiles').doc(auth().currentUser?.uid).update({
            avatar: fileName,
          })
          OnlinePlayer.store.avatar = await getIMG(fileName)
        } catch (error) {
          captureException(error)
        }
      }
    } catch (error) {
      captureException(error)
    }
  },
  async updateStep(): Promise<void> {
    upStepOnline()
  },
  async getPoster(): Promise<void> {
    try {
      OnlinePlayer.store.isPosterLoading = true
      const jsonResponse = await (
        await fetch('https://leelachakra.com/resource/LeelaChakra/poster.json')
      ).json()
      console.log('🚀 - jsonResponse', jsonResponse)
      OnlinePlayer.store.poster = jsonResponse
    } catch (error) {
      captureException(error)
    } finally {
      OnlinePlayer.store.isPosterLoading = false
    }
  },
  getLeftTime(lastTime) {
    const day = 86400000
    const hour = 3600000
    const min = 60000
    const sec = 1000
    const dateNow = Date.now()
    const passTime = dateNow - lastTime
    const difference = day - passTime

    if (difference <= 0) {
      return '0'
    } else if (difference < min) {
      const secCount = Math.round(difference / sec)
      return `${secCount} ${i18next.t('timestamps-short.sec')}`
    } else if (difference < hour) {
      const minCount = Math.round(difference / min)
      return `${minCount} ${i18next.t('timestamps-short.min')}`
    } else {
      const hourCount = Math.round(difference / hour)
      return `${hourCount} ${i18next.t('timestamps-short.h')}`
    }
  },
})

interface Istore {
  store: OnlinePlayerStore
  resetGame: () => Promise<void>
  SignOut: () => Promise<void>
  getProfile: () => Promise<void>
  uploadImage: () => Promise<void>
  updateStep: () => Promise<void>
  getPoster: () => Promise<void>
  SignOutToOffline: () => Promise<void>
  getLeftTime: (lastTime: number) => string
}

interface OnlinePlayerStore {
  // game
  start: boolean
  finish: boolean
  stepTime: number
  timeText: string
  canGo: boolean
  plan: number
  // addons
  firstGame: boolean
  loadingProf: boolean
  history: HistoryT[]
  isReported: boolean
  avatar: string
  profile: {
    firstName: string
    lastName: string
    email: string
    intention: string
  }
  // poster
  poster: {
    imgUrl: string
    eventUrl: string
    buttonColor: string
  }
  isPosterLoading: boolean
  flagEmoji?: string
  status?: status
}
