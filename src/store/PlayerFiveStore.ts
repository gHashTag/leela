import { updateStep } from './helper'
import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'

const PlayerFiveStore = makeAutoObservable({
  player: 5,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerFive = {
  resetGame(): void {
    PlayerFiveStore.start = false
    PlayerFiveStore.finish = false
    PlayerFiveStore.plan = 68
    PlayerFiveStore.history.clear()
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerFiveStore)
  }
}

persistence({
  name: 'PlayerFiveStore',
  properties: ['plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(PlayerFiveStore)

export { PlayerFiveStore, actionPlayerFive }
