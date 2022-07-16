import Purchases from 'react-native-purchases'

import { makeAutoObservable } from 'mobx'
import { captureException } from '../constants'
import firestore from '@react-native-firebase/firestore'

export const PurchasesStore = makeAutoObservable<Istore>({
  store: {
    subscribeId: 'no yet',
    firstSession: 10,
    trialTimeLeft: 0
  },
  async fetchOrCreateIdentiferData() {
    const { originalAppUserId } = await Purchases.getPurchaserInfo()
    try {
      const file = (
        await firestore().collection('Identities').doc(originalAppUserId).get()
      ).data()
      PurchasesStore.store.subscribeId = originalAppUserId
      if (file) {
        PurchasesStore.store.firstSession = file.firstSession
      } else {
        const nowDate = Date.now()
        firestore()
          .collection('Identities')
          .doc(originalAppUserId)
          .set({ subscribeId: originalAppUserId, firstSession: nowDate })
      }
    } catch (error) {
      captureException(error)
    }
  },
  async getIsSubscribe() {
    const purchaserInfo = await Purchases.getPurchaserInfo()
    const file = (
      await firestore()
        .collection('Identities')
        .doc(purchaserInfo.originalAppUserId)
        .get()
    ).data()
    if (file) {
      const nowDate = Date.now()
      if (nowDate - file.firstSession >= 2592000000) {
        if (
          typeof purchaserInfo.entitlements.active.sixMonth !== 'undefined' ||
          typeof purchaserInfo.entitlements.active.month !== 'undefined' ||
          typeof purchaserInfo.entitlements.active.year !== 'undefined'
        ) {
          return true
        } else {
          return false
        }
      } else {
        return true
      }
    } else {
      return false
    }
  },
  async buyOnlineSubscription(period) {}
})

const subscriptionKeys = {
  sixMonth: 'rc_6_m',
  month: 'rc_249_m',
  year: 'rc_12_yearly'
}

interface Istore {
  store: PurchasesStoreT
  fetchOrCreateIdentiferData: () => Promise<void>
  getIsSubscribe: () => Promise<boolean>
  buyOnlineSubscription: (period: 'sixMonth' | 'month' | 'year') => Promise<void>
}

interface PurchasesStoreT {
  subscribeId: string
  firstSession: number
  trialTimeLeft: number
}
