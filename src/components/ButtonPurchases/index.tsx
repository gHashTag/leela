import React, { memo } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import * as Sentry from '@sentry/react-native'
import { secondary, W } from '../../constants'
import { I18n } from '../../utils'
import { Txt } from '../Txt'
import { Space } from '../Space'
import { actionsSubscribe } from '../../store'

const styles = StyleSheet.create({
  container: {
    elevation: 8,
    borderRadius: 20,
    borderColor: secondary,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    width: W - 60,
    alignSelf: 'center'
  },
  h: {
    marginTop: 5,
    marginBottom: 5
  }
})

interface ButtonPurchasesT {
  purchasesPackage: PurchasesPackage
}

const ButtonPurchases = memo<ButtonPurchasesT>(purchasesPackage => {
  const {
    product: { price_string, description }
  } = purchasesPackage.purchasesPackage
  const { container } = styles

  const onSelection = async () => {
    try {
      const { purchaserInfo } = await Purchases.purchasePackage(purchasesPackage.purchasesPackage)
      if (typeof purchaserInfo.entitlements.active.my_entitlement_identifier !== 'undefined') {
        // Unlock that great "pro" content
        actionsSubscribe.setVisible(true)
      }
    } catch (e) {
      if (!e.userCancelled) {
        Sentry.captureException(e)
      }
    }
  }
  return (
    <TouchableOpacity onPress={onSelection} style={container}>
      <Txt h0 title={description} />
      <Space height={5} />
      <Txt h3 title={I18n.t(description)} />
      <Space height={10} />
      <Txt h2 title={price_string} />
    </TouchableOpacity>
  )
})

export { ButtonPurchases }
