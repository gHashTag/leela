import { updateStep } from './helper'
import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'

const PlayerFourStore = makeAutoObservable({
  player: 4,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerFour = {
  resetGame(): void {
    PlayerFourStore.start = false
    PlayerFourStore.finish = false
    PlayerFourStore.plan = 68
    PlayerFourStore.history.clear()
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerFourStore)
  }
}

persistence({
  name: 'PlayerFourStore',
  properties: ['plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(PlayerFourStore)

export { PlayerFourStore, actionPlayerFour }
