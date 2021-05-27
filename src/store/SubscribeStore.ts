import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import Purchases from 'react-native-purchases'
import { writeStore, readStore } from './helper'

const SubscribeStore = makeAutoObservable({
  visible: false,
  today: '',
  subscriptionActive: false,
  isAnonymous: true,
  userId: ''
})

const actionsSubscribe = {
  setVisible(arg: boolean) {
    SubscribeStore.visible = arg
  },
  setToday(date: string) {
    SubscribeStore.today = date
  },
  async purchaserInfo() {
    const purchaserInfo = await Purchases.getPurchaserInfo()
    if (typeof purchaserInfo.entitlements.active.my_entitlement_identifier !== 'undefined') {
      SubscribeStore.subscriptionActive = true
      SubscribeStore.userId = await Purchases.getAppUserID()
      SubscribeStore.isAnonymous = await Purchases.isAnonymous()
    } else {
      SubscribeStore.isAnonymous = await Purchases.isAnonymous()
      SubscribeStore.subscriptionActive = false
    }
  }
}

persistence({
  name: 'SubscribeStore',
  properties: ['today'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(SubscribeStore)

export { SubscribeStore, actionsSubscribe }
