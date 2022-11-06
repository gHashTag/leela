import { makeAutoObservable } from 'mobx'
import { makePersistable } from 'mobx-persist-store'
import { upStepOffline } from './helper'
import { actionsDice } from '.'
import { HistoryT } from '../types'
import { navigate } from '../constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import I18n from 'i18n-js'

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
    [{ createDate: Date.now(), plan: 68, count: 0, status: 'start' }]
  ]
}

export const OfflinePlayers = {
  store: makeAutoObservable<OfflinePlayersI>({ ...initStore }),
  async resetGame(): Promise<void> {
    actionsDice.resetPlayer()
    await AsyncStorage.clear()
    /* вы подумаете тут можно это все заменить 1 строчкой:
    `` OfflinePlayers.store = {...initStore} ``, а нет. Так 
    в persist-store результат не сохраняется */
    OfflinePlayers.store.plans = initStore.plans
    OfflinePlayers.store.start = initStore.start
    OfflinePlayers.store.histories = initStore.histories
    OfflinePlayers.store.finish = initStore.finish
    navigate('WELCOME_SCREEN')
  },
  startGame() {
    actionsDice.setMessage(I18n.t('sixToBegin'))
  },
  updateStep(id: number): void {
    upStepOffline(id)
  }
}

makePersistable(OfflinePlayers.store, {
  name: 'OfflinePlayers',
  properties: ['plans', 'start', 'histories', 'finish']
})

interface OfflinePlayersI {
  start: boolean[]
  finish: boolean[]
  plans: number[]
  histories: HistoryT[][]
}
