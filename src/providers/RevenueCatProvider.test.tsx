import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'
import Purchases from 'react-native-purchases'
import { RevenueCatProvider, useRevenueCat } from './RevenueCatProvider'

jest.mock('@env', () => ({ APPLE: 'appl_test_public', RU_STORE: 'false' }))
jest.mock('../constants', () => ({
  captureException: jest.fn(),
  onLeaveFeedback: jest.fn()
}))
jest.mock('../store/DiceStore', () => ({
  DiceStore: { online: false },
  actionsDice: {}
}))
jest.mock('../screens/helper', () => ({ getProfile: jest.fn() }))
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  LOG_LEVEL: { DEBUG: 0 },
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest
      .fn()
      .mockResolvedValue({ current: { availablePackages: [] } }),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn()
  }
}))

const paid = { entitlements: { active: { 'pro plan': {} } } }
const free = { entitlements: { active: {} } }
let value: ReturnType<typeof useRevenueCat>
function Reader() {
  value = useRevenueCat()
  return null
}

describe('native purchase outcomes and offline entitlement', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    ;(Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(paid)
    render(
      <RevenueCatProvider>
        <Reader />
      </RevenueCatProvider>
    )
    await waitFor(() => expect(value.user.pro).toBe(true))
  })

  it('restores paid access at startup even on the offline board', () => {
    expect(value.user.pro).toBe(true)
  })

  it('returns false for cancellation and throws purchase/restore failures', async () => {
    ;(Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({
      userCancelled: true
    })
    await expect(value.purchasePackage!({} as any)).resolves.toBe(false)
    ;(Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce(
      new Error('store unavailable')
    )
    await expect(value.purchasePackage!({} as any)).rejects.toThrow(
      'store unavailable'
    )
    ;(Purchases.restorePurchases as jest.Mock).mockRejectedValueOnce(
      new Error('restore unavailable')
    )
    await expect(value.restorePermissions!()).rejects.toThrow(
      'restore unavailable'
    )
  })

  it('reports success only for an active purchased entitlement and refreshes restore', async () => {
    ;(Purchases.purchasePackage as jest.Mock).mockResolvedValueOnce({
      customerInfo: free
    })
    await act(async () => {
      expect(await value.purchasePackage!({} as any)).toBe(false)
    })
    expect(value.user.pro).toBe(false)
    ;(Purchases.restorePurchases as jest.Mock).mockResolvedValueOnce(paid)
    await act(async () => {
      await value.restorePermissions!()
    })
    expect(value.user.pro).toBe(true)
  })
})
import { it } from '@jest/globals'
