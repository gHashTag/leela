import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, getCurrentUser, getHistory } from './helper'
import { actionsDice, DiceStore } from './'
import { updateStep, updateProfile } from './helper'
import { DataStore, Storage } from 'aws-amplify'
import { Profile } from '../models'
import { captureException } from '../constants'
import { getImagePicker, getIMG, uploadImg } from '../screens/helper'

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
  }]
})

const actionPlayerOne = {
  async initOnlineGame(plan: number): Promise<void> {
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
  },
  async resetGame(): Promise<void> {
    PlayerOneStore.start = false
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
        PlayerOneStore.profile = arrProfile
        PlayerOneStore.history = await getHistory()
        PlayerOneStore.avatar = await getIMG(arrProfile.avatar)
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
    }
  },
  async getHistory(): Promise<void> {
    try {
      PlayerOneStore.history = await getHistory()
    } catch (error) {
      console.log(`error`, error)
      captureException(error)
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
            const original = await DataStore.query(Profile, arrProfile.id)
            if (original) {
              await DataStore.save(
                Profile.copyOf(original, updated => {
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
  properties: ['player', 'plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    delay: 200
  }
})(PlayerOneStore)

export { PlayerOneStore, actionPlayerOne }
