import { makeAutoObservable } from 'mobx'
import { makePersistable } from 'mobx-persist-store'
import { storageAdapter } from './storageAdapter'

const BadgeAndroidStore = makeAutoObservable({
  count: 0
})

makePersistable(BadgeAndroidStore, {
  name: 'BadgeAndroidStore',
  properties: ['count'],
  storage: storageAdapter
})

export { BadgeAndroidStore }
