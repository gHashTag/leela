import { makeAutoObservable } from 'mobx'
import { makePersistable } from 'mobx-persist-store'

const BadgeAndroidStore = makeAutoObservable({
  count: 0,
})

makePersistable(BadgeAndroidStore, {
  name: 'BadgeAndroidStore',
  properties: ['count'],
})

export { BadgeAndroidStore }
