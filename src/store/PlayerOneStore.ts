import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice, DiceStore } from './'
import { updateStep, updateProfile } from './helper'

const PlayerOneStore = makeAutoObservable({
  player: 1,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

// const fetchData = async () => {
//   const { idToken } = await Auth.currentSession()
//   const email = idToken.payload.email
//   console.log(`email`, email)
//   if (email) {
//       const user = await DataStore.query(Profile, c => c.email('eq', email))
//       return user
//   }
// }

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
  }
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
