import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { Auth, DataStore, Storage } from 'aws-amplify'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, updateStep } from './helper'
import { actionsDice, DiceStore } from '.'
import { Profile } from '../models'
import { Profile as ProfileT } from '../models'
import { captureException } from '../constants'
import { createHistory, getCurrentUser, getHistory, getImagePicker, getIMG, updatePlan, uploadImg } from '../screens/helper'
import { History } from '../models'

const initStore = {
  start: [false, false, false, false,false, false],
  finish: [false, false, false, false,false, false],
  plans: [68, 68, 68, 68, 68, 68],
  plansPrev: [68, 68, 68, 68, 68, 68],
  histories: [
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
    [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
  ]
}

const PlayersStore = makeAutoObservable({
  ...initStore,
})

const initProfile = {
  id: '0',
  firstName: '',
  lastName: '',
  email: '',
  plan: 68,
  mainRoomId: undefined as any
}

const OnlineOtherPlayers = makeAutoObservable({
  players: [
    {id: 'none', curAvatar: ''}
  ] as any
})

const OnlinePlayerStore = makeAutoObservable({
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  histories: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
  avatar: '',
  prevAvatar: '' as any,
  nextAvatar: '' as any,
  profile: initProfile,
  poster: {
    imgUrl: "https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.jpg",
    eventUrl: "",
    buttonColor: '#1c1c1c'
  },
  isPosterLoading: false,
  subs: {
    profile: '' as any,
    history: '' as any
  },
  stepTime: 0,
  canGo: false
})

const actionPlayers = {
  async resetGame(): Promise<void> {
    const user = await getCurrentUser()
    PlayersStore.start = initStore.start
    PlayersStore.finish = initStore.finish
    PlayersStore.plans = initStore.plans
    PlayersStore.histories = initStore.histories
    if (DiceStore.online) {
      await DataStore.save(
        Profile.copyOf(user, updated => {
        updated.mainHelper = '',
        updated.lastStepTime = (Date.now() - 86400000).toString()
      }))
      OnlinePlayerStore.start = false
      OnlinePlayerStore.finish = false
      OnlinePlayerStore.plan = 68
      OnlinePlayerStore.planPrev = 68
      OnlinePlayerStore.profile.mainRoomId = undefined
      OnlinePlayerStore.canGo = true
      OnlinePlayerStore.histories = 
       [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
      updatePlan(68)
      createHistory({id: uuidv4(), plan: 68, count: 0, status: 'start'})
    }
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  async SignOut(): Promise<void> {
    OnlinePlayerStore.avatar = ''
    OnlinePlayerStore.profile = initProfile
    OnlinePlayerStore.start = false
    OnlinePlayerStore.finish = false
    OnlinePlayerStore.plan = 68
    OnlinePlayerStore.planPrev = 68
    OnlinePlayerStore.histories = [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
    OnlinePlayerStore.subs.profile.unsubscribe()
    OnlinePlayerStore.subs.history.unsubscribe()
    Auth.signOut()
  },
  updateStep(id: number | undefined): void {
    updateStep(id)
  },
  async getProfile(): Promise<void> {
    try {
      const arrProfile: ProfileT | undefined = await getCurrentUser()
      const plan = arrProfile?.plan
      if (plan) {
        OnlinePlayerStore.plan = plan
        if (plan === 68) {
          DiceStore.startGame = false
          OnlinePlayerStore.start = false
        } else {
          DiceStore.startGame = true
          OnlinePlayerStore.start = true
        }
      }
      if (arrProfile !== undefined) {
        OnlinePlayerStore.profile = {
          ...OnlinePlayerStore.profile,
          id: arrProfile.id,
          firstName: arrProfile.firstName,
          lastName: arrProfile.lastName,
          email: arrProfile.email,
          plan: arrProfile.plan,
        }
        OnlinePlayerStore.stepTime = Number(arrProfile.lastStepTime)
      }
      if (arrProfile?.mainHelper) {
        OnlinePlayerStore.profile.mainRoomId = arrProfile.mainHelper
      }
      OnlinePlayerStore.prevAvatar = OnlinePlayerStore.nextAvatar
      OnlinePlayerStore.nextAvatar = arrProfile?.avatar
      if (arrProfile?.avatar && OnlinePlayerStore.prevAvatar
      !== OnlinePlayerStore.nextAvatar && arrProfile.avatar) {
        OnlinePlayerStore.avatar = await getIMG(arrProfile.avatar)
      }
      OnlinePlayerStore.histories = await getHistory()
      OnlinePlayerStore.stepTime = Number(arrProfile?.lastStepTime)
      actionPlayers.getOtherProf()
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
    }
  },
  async getOtherProf(): Promise<void> {
    try {
      if (OnlinePlayerStore.profile.mainRoomId) { 
        const profiles = await DataStore.query(Profile, c => 
          c.mainHelper('eq', OnlinePlayerStore.profile.mainRoomId))
        const filterRes = profiles.filter(a => a.email !== OnlinePlayerStore.profile.email)
        if (filterRes.length > 0) {
          const res = await Promise.all(filterRes.map(async a => {
            const profHis = await DataStore.query
             (History, c => c.ownerProfId('eq', a.id))
            const ava = await getIMG(a.avatar)
            return {
              plan: a.plan,
              firstName: a.firstName,
              lastName: a.lastName,
              prevAvatar: OnlineOtherPlayers.players.find(b => b.id === a.id )?.curAvatar,
              curAvatar: a.avatar,
              avatar: ava,
              history: profHis,
              id: a.id
            }
          }))
          OnlineOtherPlayers.players = res
        }
      }    
    } catch (error) {
      captureException(error)
    }
  },
  async getHistory(): Promise<void> {
    try {
      OnlinePlayerStore.histories = await getHistory()
    } catch (error) {
      captureException(error)
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
          const arrProfile: ProfileT | undefined = await getCurrentUser()
          arrProfile?.avatar && 
          await Storage.remove(arrProfile.avatar)
          if (arrProfile) {
            await DataStore.save(
              Profile.copyOf(arrProfile, updated => {
                updated.avatar = fileName
              })
            )
          }
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
