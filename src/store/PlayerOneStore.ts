import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { DataStore, Storage } from 'aws-amplify'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, updateStep } from './helper'
import { actionsDice, DiceStore } from './'
import { Profile } from '../models'
import { captureException } from '../constants'
import { getCurrentUser, getHistory, getImagePicker, getIMG, updateProfile, uploadImg } from '../screens/helper'

const PlayerOneStore = makeAutoObservable({
  player: 1,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }],
  avatar: '',
  profile: [{
    id: '0',
    firstName: '',
    lastName: '',
    email: '',
    plan: 68,
    avatar: ''
  }],
  poster: {
    imgUrl: "https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.jpg",
    eventUrl: "",
    buttonColor: '#1c1c1c'
  },
  isPosterLoading: false,
})

const actionPlayerOne = {
  async resetGame(): Promise<void> {
    PlayerOneStore.start = false
    PlayerOneStore.avatar = ''
    PlayerOneStore.finish = false
    PlayerOneStore.plan = 68
    PlayerOneStore.history = [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
    updateProfile(68)
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerOneStore)
  },
  async getProfile(): Promise<void> {
    try {
        const arrProfile = await getCurrentUser()
        const plan = arrProfile?.plan
        if (plan) {
          PlayerOneStore.plan = plan
          if (plan === 68) {
            DiceStore.startGame = false
            PlayerOneStore.start = false
          } else {
            DiceStore.startGame = true
            PlayerOneStore.start = true
          }
        }
        PlayerOneStore.profile = arrProfile
        PlayerOneStore.history = await getHistory()
        const avatar = arrProfile?.avatar
        PlayerOneStore.avatar = await getIMG(avatar)
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
    }
  },
  async getHistory(): Promise<void> {
    try {
      PlayerOneStore.history = await getHistory()
    } catch (error) {
      captureException(error)
    }
  },
  async getPoster(): Promise<void> {
    try {
      PlayerOneStore.isPosterLoading = true
      const response = await fetch('https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.json')
      const json = await response.json() 
      PlayerOneStore.poster = json[0]
    } catch (error) {
      captureException(error)
    } finally {
      PlayerOneStore.isPosterLoading = false
    }
  },
  async uploadImage(): Promise<void> {
    try {
      const image = await getImagePicker()
      if (image) {
          try {   
            const fileName = await uploadImg(image)
            const arrProfile = await getCurrentUser()
            await Storage.remove(arrProfile.avatar)
            if (arrProfile) {
              await DataStore.save(
                Profile.copyOf(arrProfile, updated => {
                  updated.avatar = fileName
                })
              )
            }
            PlayerOneStore.avatar = await getIMG(fileName)
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
  name: 'PlayerOneStore',
  properties: ['player', 'plan', 'planPrev', 'start', 'history', 'finish', 'poster'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    delay: 200
  }
})(PlayerOneStore)

export { PlayerOneStore, actionPlayerOne }
