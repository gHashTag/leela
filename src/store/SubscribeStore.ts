import { makeAutoObservable } from 'mobx'
import { makePersistable } from 'mobx-persist-store'
import { storageAdapter } from './storageAdapter'

/**
 * Whether the game is stopped pending a subscription.
 *
 * `false`, and nothing sets it back. It defaulted to `true` and the provider
 * turned it off once it had asked the store about the player - so a launch with
 * no network, or one where that answer was slow, met a dimmed die. There is no
 * paywall now: see `RevenueCatProvider`, which used to call `blockGame()` on a
 * player's third square.
 */
const SubscribeStore = makeAutoObservable({
  isBlockGame: false
})

const actionSubscribeStore = {
  unBlock: async () => {
    SubscribeStore.isBlockGame = false
  },
  resetStore: async () => {
    SubscribeStore.isBlockGame = false
  }
}

makePersistable(SubscribeStore, {
  name: 'SubscribeStore',
  properties: [],
  storage: storageAdapter
})

export { SubscribeStore, actionSubscribeStore }
