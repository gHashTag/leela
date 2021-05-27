import { updateStep } from './helper'
import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'

const PlayerThreeStore = makeAutoObservable({
  player: 3,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerThree = {
  resetGame(): void {
    PlayerThreeStore.start = false
    PlayerThreeStore.finish = false
    PlayerThreeStore.plan = 68
    PlayerThreeStore.history.clear()
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerThreeStore)
  }
}

persistence({
  name: 'PlayerThreeStore',
  properties: ['plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(PlayerThreeStore)

export { PlayerThreeStore, actionPlayerThree }
