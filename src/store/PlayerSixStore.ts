import { updateStep } from './helper'
import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'

const PlayerSixStore = makeAutoObservable({
  player: 6,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerSix = {
  resetGame(): void {
    PlayerSixStore.start = false
    PlayerSixStore.finish = false
    PlayerSixStore.plan = 68
    PlayerSixStore.history.clear()
    actionsDice.setMessage(' ')
    actionsDice.resetPlayer()
  },
  updateStep(): void {
    updateStep(PlayerSixStore)
  }
}

persistence({
  name: 'PlayerSixStore',
  properties: ['plan', 'planPrev', 'start', 'history', 'finish'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(PlayerSixStore)

export { PlayerSixStore, actionPlayerSix }
