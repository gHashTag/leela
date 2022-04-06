import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { Auth, DataStore, SortDirection, Storage } from 'aws-amplify'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, updateStep } from './helper'
import { actionsDice, DiceStore } from '.'
import { Profile } from '../models'
import { Profile as ProfileT } from '../models'
import { captureException } from '../constants'
import { createHistory, getCurrentUser, getHistory, getImagePicker, getIMG, updatePlan, uploadImg } from '../screens/helper'

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
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  mainRoomId: ''
}

const OnlineOtherPlayers = makeAutoObservable({
  players: [
    {id: 'none', curAvatar: '', history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]}
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
  subs: undefined as any,
  stepTime: 0,
  canGo: false,
  loading: true as Boolean
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
      const user = await getCurrentUser()
      if (user) {
        await DataStore.save(
          Profile.copyOf(user, updated => {
          updated.mainHelper = ''
        }))
      }
      OnlinePlayerStore.start = false
      OnlinePlayerStore.finish = false
      OnlinePlayerStore.plan = 68
      OnlinePlayerStore.planPrev = 68
      OnlinePlayerStore.profile.mainRoomId = ''
      OnlinePlayerStore.canGo = true
      OnlinePlayerStore.histories = 
       [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
      updatePlan(68)
      createHistory({id: uuidv4(), plan: 68, count: 0, status: 'start'})
    }
    actionsDice.setMessage(' ')
  },
  async SignOut(): Promise<void> {
    OnlinePlayerStore.avatar = ''
    OnlinePlayerStore.profile = initProfile
    OnlinePlayerStore.start = false
    OnlinePlayerStore.finish = false
    OnlinePlayerStore.plan = 68
    OnlinePlayerStore.planPrev = 68
    OnlinePlayerStore.histories = [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
    OnlinePlayerStore.subs.unsubscribe()
    Auth.signOut()
  },
  updateStep(id: number | undefined): void {
    updateStep(id)
  },
  async getProfile(): Promise<void> {
    try {
      OnlinePlayerStore.loading = true
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
          email: arrProfile.email
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
      await actionPlayers.getOtherProf()
      OnlinePlayerStore.loading = false
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
    }
  },
  async getOtherProf(): Promise<void> {
    try {
      const {profile} = OnlinePlayerStore
      const {players} = OnlineOtherPlayers
      if (profile.mainRoomId) { 
        const profiles = await DataStore.query(Profile, c => 
          c.mainHelper('eq', profile.mainRoomId))
        const filterRes = profiles.filter(a => a.email !== profile.email)
        if (filterRes.length > 0) {
          const res = await Promise.all(filterRes.map(async (a, id) => {
            return {
              plan: a.plan,
              firstName: a.firstName,
              lastName: a.lastName,
              prevAvatar: players.find(b => b.id === a.id )?.curAvatar,
              curAvatar: a.avatar,
              avatar: players.prevAvatar === a.avatar  ? 
               players[id].avatar : await getIMG(a.avatar),
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
