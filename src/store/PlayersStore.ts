import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, updateStep } from './helper'
import { actionsDice, DiceStore } from '.'
import { captureException } from '../constants'
import { getProfile, getImagePicker, getIMG, updatePlan, uploadImg, getFireBaseRef } from '../screens/helper'
import auth from '@react-native-firebase/auth'
import storage from '@react-native-firebase/storage'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { OtherUsersT, UserT } from '../types'
import { delTokenOnSignOut } from './MessagingStore'

interface GetOtherI {
  snapshot?: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
}

const initStore = {
  start: [false, false, false, false, false, false],
  finish: [false, false, false, false, false, false],
  plans: [68, 68, 68, 68, 68, 68],
  plansPrev: [68, 68, 68, 68, 68, 68],
  histories: [
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
  ]
}

const PlayersStore = makeAutoObservable({
  ...initStore,
})

const initProfile = {
  firstName: '',
  lastName: '',
  email: ''
}

const OnlineOtherPlayers = makeAutoObservable({
  players: [] as any
})

const OnlinePlayerStore = makeAutoObservable({
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  histories: [{ plan: 68, count: 0, status: 'start', createDate: 999999999999999 }],
  avatar: '',
  prevAvatar: '',
  nextAvatar: '',
  profile: initProfile,
  poster: {
    imgUrl: "https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.jpg",
    eventUrl: "",
    buttonColor: '#1c1c1c'
  },
  isPosterLoading: false,
  stepTime: 0,
  canGo: false,
  firstGame: false,
  loading: true as Boolean,
  timeText: ' '
})

const actionPlayers = {
  async resetGame(): Promise<void> {
    if (!DiceStore.online) {
      actionsDice.resetPlayer()
      PlayersStore.start = initStore.start
      PlayersStore.finish = initStore.finish
      PlayersStore.plans = initStore.plans
      PlayersStore.histories = initStore.histories
    }
    if (DiceStore.online) {
      OnlinePlayerStore.start = false
      OnlinePlayerStore.finish = false
      OnlinePlayerStore.plan = 68
      OnlinePlayerStore.planPrev = 68
      OnlinePlayerStore.histories = [{
        createDate: Date.now(), plan: 68,
        count: 0, status: 'start'
      }]
      updatePlan(68)
    }
    actionsDice.setMessage(' ')
  },
  async SignOut(): Promise<void> {
    const userUid = auth().currentUser?.uid
    await getFireBaseRef(`/online/${userUid}`).set(false)
    await delTokenOnSignOut()
    OnlinePlayerStore.avatar = ''
    OnlinePlayerStore.profile = initProfile
    OnlinePlayerStore.start = false
    OnlinePlayerStore.finish = false
    OnlinePlayerStore.nextAvatar = ''
    OnlinePlayerStore.plan = 68
    OnlinePlayerStore.planPrev = 68
    OnlinePlayerStore.histories = [{
      createDate: 99999999999, plan: 68,
      count: 0, status: 'start'
    }]
    await auth().signOut()
  },
  updateStep(id: number): void {
    updateStep(id)
  },
  async getProfile(): Promise<void> {
    try {
      OnlinePlayerStore.loading = true
      const curProf = await getProfile()
      if (curProf) {
        const plan = curProf.plan
        OnlinePlayerStore.plan = plan
        DiceStore.startGame = curProf.start
        OnlinePlayerStore.start = curProf.start
        OnlinePlayerStore.firstGame = curProf.firstGame
        OnlinePlayerStore.profile = {
          ...OnlinePlayerStore.profile,
          firstName: curProf.firstName,
          lastName: curProf.lastName,
          email: curProf.email
        }
        OnlinePlayerStore.stepTime = curProf.lastStepTime
        OnlinePlayerStore.canGo = Date.now() - curProf.lastStepTime >= 86400000
        OnlinePlayerStore.prevAvatar = OnlinePlayerStore.nextAvatar
        OnlinePlayerStore.nextAvatar = curProf.avatar ? curProf.avatar : ''
        if (curProf.avatar && OnlinePlayerStore.prevAvatar
          !== curProf.avatar) {
          OnlinePlayerStore.avatar = await getIMG(curProf.avatar)
        }
        OnlinePlayerStore.histories = curProf.history
          .sort((a, b) => b.createDate - a.createDate).slice(0, 30)
      }
      OnlinePlayerStore.loading = false
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
    }
  },
  async getOtherProf({ snapshot }: GetOtherI) {
    if (snapshot) {
      const otherData: any = await Promise.all(snapshot.docs.map(async (a, id) => {
        if (a.exists) {
          const data: OtherUsersT = a.data() as OtherUsersT
          let isOnline
          await getFireBaseRef(`/online/${data.owner}`).once('value')
            .then(async snapshot => {
              isOnline = snapshot.val()
            })
          if (isOnline) {
            return {
              email: data.email,
              plan: data.plan,
              firstName: data.firstName,
              lastName: data.lastName,
              avatar: data.avatar ? await getIMG(data.avatar) : undefined,
              owner: data.owner
            }
          }
        }
      }))
      if (otherData) {
        OnlineOtherPlayers.players = otherData.filter((a: any) => a !== undefined)
      }
    }
  },
  async getPoster(): Promise<void> {
    try {
      OnlinePlayerStore.isPosterLoading = true
      const response = await fetch('https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.json')
      const json = await response.json()
      OnlinePlayerStore.poster = json[0]
    } catch (error) {
      captureException(error)
    } finally {
      OnlinePlayerStore.isPosterLoading = false
    }
  },
  async uploadImage(): Promise<void> {
    try {
      const image = await getImagePicker()
      if (image) {
        try {
          const fileName = await uploadImg(image)
          if (auth().currentUser?.photoURL) {
            await storage().ref(auth().currentUser?.photoURL).delete()
          }
          auth().currentUser?.updateProfile({
            photoURL: fileName
          })
          firestore().collection('Profiles').doc(auth().currentUser?.uid).update({
            avatar: fileName
          })
          OnlinePlayerStore.avatar = await getIMG(fileName)
        } catch (error) {
          captureException(error)
        }
      }
    } catch (error) {
      captureException(error)
    }
  },
}

persistence({
  name: 'PlayersStore',
  properties: ['plans', 'plansPrev', 'start', 'histories', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    delay: 200
  }
})(PlayersStore)

export { PlayersStore, actionPlayers, OnlinePlayerStore, OnlineOtherPlayers }
