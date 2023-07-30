import { makeAutoObservable } from 'mobx'
import { makePersistable } from 'mobx-persist-store'

const SubscribeStore = makeAutoObservable({
  isBlockGame: false // defaout false
})

const actionSubscribeStore = {
  unBlock: async () => {
    SubscribeStore.isBlockGame = false
  },
  blockGame: async () => {
    SubscribeStore.isBlockGame = true
  }
}

makePersistable(SubscribeStore, {
  name: 'SubscribeStore',
  properties: ['isBlockGame']
})

export { SubscribeStore, actionSubscribeStore }
