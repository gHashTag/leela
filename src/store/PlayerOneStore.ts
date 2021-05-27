import { v4 as uuidv4 } from 'uuid'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'
import { actionsDice } from './'
import { updateStep } from './helper'

const PlayerOneStore = makeAutoObservable({
  player: 1,
  start: false,
  finish: false,
  plan: 68,
  planPrev: 68,
  history: [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
})

const actionPlayerOne = {
  resetGame(): void {
    PlayerOneStore.start = false
    PlayerOneStore.finish = false
    PlayerOneStore.plan = 68
    PlayerOneStore.history = [{ id: uuidv4(), plan: 68, count: 0, status: 'start' }]
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
