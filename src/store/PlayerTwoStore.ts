import { updateStep } from './helper'
import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'

const PlayerTwoStore = makeAutoObservable({
  player: 2,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerTwo = {
  resetGame(): void {
    PlayerTwoStore.start = false
    PlayerTwoStore.finish = false
    PlayerTwoStore.plan = 68
    PlayerTwoStore.history.clear()
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerTwoStore)
  }
}

persistence({
  name: 'PlayerTwoStore',
  properties: ['plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(PlayerTwoStore)

export { PlayerTwoStore, actionPlayerTwo }
