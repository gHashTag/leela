import { APPLE, GOOGLE, RU_STORE } from '@env'
import React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases'
import { CustomerInfo } from 'react-native-purchases'
import { captureException, onLeaveFeedback } from '../constants'
import { actionSubscribeStore } from '../store/SubscribeStore'
import { PostStore } from '../store/PostStore'
import { getProfile } from '../screens/helper'
import { UserT } from '../types/types'
import { DiceStore, actionsDice } from '../store/DiceStore'

// Use your RevenueCat API keys
const APIKeys = {
  apple: APPLE,
  google: GOOGLE
}

interface RevenueCatProps {
  purchasePackage?: (pack: PurchasesPackage) => Promise<void>
  restorePermissions?: () => Promise<CustomerInfo>
  user: UserState
  packages: PurchasesPackage[]
  isLoading: boolean
}

interface CustomerInfoT {
  entitlements: {
    active: { [key: string]: unknown }
  }
}

export interface UserState {
  pro: boolean
}

const RevenueCatContext = createContext<RevenueCatProps>({
  purchasePackage: async () => {},
  restorePermissions: async () => ({}) as CustomerInfo,
  user: { pro: false },
  packages: [],
  isLoading: false
})

// Export context for easy usage
export const useRevenueCat = () => {
  return useContext(RevenueCatContext) as RevenueCatProps
}

// Provide RevenueCat functions to our app
export const RevenueCatProvider = ({ children }: any) => {
  const [user, setUser] = useState<UserState>({ pro: false })
  const [packages, setPackages] = useState<PurchasesPackage[]>([])

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: APIKeys.google })
      } else {
        Purchases.configure({ apiKey: APIKeys.apple })
      }

      // Use more logging during debug if want!
      Purchases.setLogLevel(LOG_LEVEL.DEBUG)

      // Listen for customer updates
      Purchases.addCustomerInfoUpdateListener(async (info) => {
        updateCustomerInformation(info)
      })

      // Load all offerings and the user object with entitlements
      await loadOfferings()
    }
    init()
  }, [])

  // Load all offerings a user can (currently) purchase
  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings()
      if (offerings.current) {
        setPackages(offerings.current.availablePackages)
      }
    } catch (error) {
      captureException(error, 'loadOfferings')
    }
  }

  // Update user state based on previous purchases
  const updateCustomerInformation = async (customerInfo: CustomerInfoT) => {
    // if (!RU_STORE) {

    let newUser: UserState = { pro: false }
    const online = DiceStore.online
    if (online) {
      const curProf: UserT | undefined = await getProfile()
      const status = curProf?.status
      const countPosts = await PostStore.countPosts()

      const isAdmin = status === 'Admin' || status === 'Free'

      const hasProPlan =
        customerInfo?.entitlements?.active?.hasOwnProperty('pro plan')

      if (isAdmin || hasProPlan) {
        newUser.pro = true
        actionSubscribeStore.unBlock()
      } else if ((countPosts ?? 0) < 5) {
        actionSubscribeStore.unBlock()
      } else if (countPosts === 10) {
        onLeaveFeedback((success) => actionsDice.setRate(success))
      } else {
        actionSubscribeStore.blockGame()
      }
    }
    // else {
    //   const hasProPlan =
    //     customerInfo?.entitlements?.active?.hasOwnProperty('pro plan')
    //   const count = OfflinePlayers.store.player1MoveCount
    //   console.warn('count', count)
    //   if (hasProPlan) {
    //     newUser.pro = true
    //     actionSubscribeStore.unBlock()
    //   } else if (count > 10) {
    //     actionSubscribeStore.blockGame()
    //   } else {
    //     actionSubscribeStore.unBlock()
    //   }
    // }

    setUser(newUser)

    // }
  }

  // Purchase a package
  const purchasePackage = async (pack: PurchasesPackage) => {
    if (!RU_STORE) {
      try {
        await Purchases.purchasePackage(pack)
      } catch (e: any) {
        if (!e.userCancelled) {
          captureException(e, 'userCancelled')
        }
      }
    }
  }

  // Restore previous purchases
  const restorePermissions = async () => {
    try {
      const customer = await Purchases.restorePurchases()
      return customer ?? {}
    } catch (error) {
      captureException(error, 'restorePermissions')
      return {}
    }
  }

  const value = {
    restorePermissions,
    user,
    packages,
    purchasePackage
  }

  return (
    // @ts-expect-error
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  )
}
