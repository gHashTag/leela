import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore, upStepOffline } from './helper'
import { actionsDice, DiceStore } from '.'
import { HistoryT } from '../types'

export const initStore = {
  start: [false, false, false, false, false, false],
  finish: [false, false, false, false, false, false],
  plans: [68, 68, 68, 68, 68, 68],
  histories: [
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }],
  ]
}

export const OfflinePlayers = {
  store: makeAutoObservable<OfflinePlayersI>(initStore),
  async resetGame(): Promise<void> {
    actionsDice.resetPlayer()
    OfflinePlayers.store = initStore
    actionsDice.setMessage(' ')
  },
  updateStep(id: number): void {
    upStepOffline(id)
  }
}

persistence({
  name: 'OfflinePlayers',
  properties: ['plans', 'start', 'histories', 'finish'],
  adapter: new StorageAdapter({
    // @ts-expect-error
    read: readStore,
    // @ts-expect-error
    write: writeStore
  }),
  reactionOptions: {
    delay: 200
  }
})(OfflinePlayers.store)

interface OfflinePlayersI {
  start: boolean[],
  finish: boolean[],
  plans: number[],
  histories: HistoryT[][]
}
