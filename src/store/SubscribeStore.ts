import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import Purchases from 'react-native-purchases'
import { ENTITLEMENT_ID } from '../constants'
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
    console.log('purchaserInfo', purchaserInfo.entitlements.active)
    if (typeof purchaserInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined') {
      SubscribeStore.subscriptionActive = true
      SubscribeStore.visible = false
      SubscribeStore.userId = Purchases.getAppUserID()
    } else {
      SubscribeStore.isAnonymous = Purchases.isAnonymous()
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
