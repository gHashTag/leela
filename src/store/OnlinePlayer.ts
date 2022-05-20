import { makeAutoObservable } from 'mobx'
import { upStepOnline } from './helper'
import { actionsDice, DiceStore } from '.'
import { captureException, navigate } from '../constants'
import {
  getProfile,
  getImagePicker,
  getIMG,
  updatePlan,
  uploadImg,
  getFireBaseRef,
  resetHistory,
  resetPlayer
} from '../screens/helper'
import auth from '@react-native-firebase/auth'
import storage from '@react-native-firebase/storage'
import firestore from '@react-native-firebase/firestore'
import { delTokenOnSignOut } from './MessagingStore'
import { HistoryT } from '../types'
import * as Keychain from 'react-native-keychain'

const initProfile = {
  firstName: '',
  lastName: '',
  email: ''
}

const initHistory = () => [
  {
    createDate: Date.now(),
    plan: 68,
    count: 0,
    status: 'start'
  }
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
    avatar: '',
    profile: initProfile,
    // poster
    poster: {
      imgUrl: 'https://s3.eu-central-1.wasabisys.com/database999/LeelaChakra/poster.jpg',
      eventUrl: '',
      buttonColor: '#1c1c1c'
    },
    isPosterLoading: false
  },
  async resetGame(): Promise<void> {
    try {
      OnlinePlayer.store = {
        ...OnlinePlayer.store,
        start: false,
        finish: false,
        plan: 68,
        history: initHistory()
      }
      await resetPlayer()
      await resetHistory()
      await updatePlan(68)
      actionsDice.setMessage(' ')
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
        loadingProf: true
      }
      actionsDice.resetPlayer()
      await Keychain.resetInternetCredentials('auth')
      await auth().signOut()
      navigate('WELCOME_SCREEN')
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
            email: curProf.email
          },
          stepTime: curProf.lastStepTime,
          canGo: Date.now() - curProf.lastStepTime >= 86400000,
          avatar: curProf.avatar ? await getIMG(curProf.avatar) : '',
          history: curProf.history
            .sort((a, b) => b.createDate - a.createDate)
            .slice(0, 30)
        }
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
          if (auth().currentUser?.photoURL) {
            // @ts-expect-error
            await storage().ref(auth().currentUser?.photoURL).delete()
          }
          await auth().currentUser?.updateProfile({
            photoURL: fileName
          })
          await firestore().collection('Profiles').doc(auth().currentUser?.uid).update({
            avatar: fileName
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
      const response = await fetch(
        'https://s3.eu-central-1.wasabisys.com/database999/LeelaChakra/poster.json'
      )
      const json = await response.json()
      OnlinePlayer.store.poster = json[0]
    } catch (error) {
      captureException(error)
    } finally {
      OnlinePlayer.store.isPosterLoading = false
    }
  }
})

interface Istore {
  store: OnlinePlayerStore
  resetGame: () => Promise<void>
  SignOut: () => Promise<void>
  getProfile: () => Promise<void>
  uploadImage: () => Promise<void>
  updateStep: () => Promise<void>
  getPoster: () => Promise<void>
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
  avatar: string
  profile: {
    firstName: string
    lastName: string
    email: string
  }
  // poster
  poster: {
    imgUrl: string
    eventUrl: string
    buttonColor: string
  }
  isPosterLoading: boolean
}
