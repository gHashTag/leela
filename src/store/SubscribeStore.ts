import { makeAutoObservable } from 'mobx'
import { hydrateStore, makePersistable } from 'mobx-persist-store'

const SubscribeStore = makeAutoObservable({
  isBlockGame: false // defaut false
})

const actionSubscribeStore = {
  unBlock: async () => {
    SubscribeStore.isBlockGame = false
  },
  blockGame: async () => {
    SubscribeStore.isBlockGame = true
  },
  resetStore: async () => {
    SubscribeStore.isBlockGame = false
    await hydrateStore(SubscribeStore)
  }
}

makePersistable(SubscribeStore, {
  name: 'SubscribeStore',
  properties: ['isBlockGame']
})

export { SubscribeStore, actionSubscribeStore }
