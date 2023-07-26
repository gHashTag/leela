import React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases'
import { CustomerInfo } from 'react-native-purchases'
import { Spin } from 'src/components'
import { captureException } from 'src/constants'

// Use your RevenueCat API keys
const APIKeys = {
  apple: 'appl_sLbsBYxSJUxCchEHnPTWyIeYtiX',
  google: 'goog_KfcnsOLBLwJvAbxGuHzzAFCVmwh'
}

interface RevenueCatProps {
  purchasePackage?: (pack: PurchasesPackage) => Promise<void>
  restorePermissions?: () => Promise<CustomerInfo>
  user: UserState
  packages: PurchasesPackage[]
}

export interface UserState {
  pro: boolean
}

const RevenueCatContext = createContext<RevenueCatProps>({
  purchasePackage: async () => {},
  restorePermissions: async () => ({} as CustomerInfo),
  user: { pro: false },
  packages: []
})

// Export context for easy usage
export const useRevenueCat = () => {
  return useContext(RevenueCatContext) as RevenueCatProps
}

// Provide RevenueCat functions to our app
export const RevenueCatProvider = ({ children }: any) => {
  const [user, setUser] = useState<UserState>({ pro: false })
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: APIKeys.google })
      } else {
        Purchases.configure({ apiKey: APIKeys.apple })
      }
      setIsReady(true)

      // Use more logging during debug if want!
      Purchases.setLogLevel(LOG_LEVEL.DEBUG)

      // Listen for customer updates
      Purchases.addCustomerInfoUpdateListener(async info => {
        updateCustomerInformation(info)
      })

      // Load all offerings and the user object with entitlements
      await loadOfferings()
    }
    init()
  }, [])

  // Load all offerings a user can (currently) purchase
  const loadOfferings = async () => {
    const offerings = await Purchases.getOfferings()
    if (offerings.current) {
      setPackages(offerings.current.availablePackages)
    }
  }

  // Update user state based on previous purchases
  const updateCustomerInformation = async (customerInfo: CustomerInfo) => {
    let newUser: UserState = { pro: false }

    if (customerInfo?.entitlements.active['pro plan'] !== undefined) {
      newUser.pro = true
    }

    setUser(newUser)
  }

  // Purchase a package
  const purchasePackage = async (pack: PurchasesPackage) => {
    try {
      await Purchases.purchasePackage(pack)
    } catch (e: any) {
      if (!e.userCancelled) {
        captureException(e, 'userCancelled')
      }
    }
  }

  // // Restore previous purchases
  const restorePermissions = async () => {
    const customer = await Purchases.restorePurchases()
    return customer
  }

  const value = {
    restorePermissions,
    user,
    packages,
    purchasePackage
  }

  // Return empty fragment if provider is not ready (Purchase not yet initialised)
  if (!isReady) {
    return <Spin />
  }

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>
}
