import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import * as Sentry from '@sentry/react-native'
import { ENTITLEMENT_ID, secondary, W } from '../../../constants'
import { I18n } from '../../../utils'
import { Text } from '../../'
import { Space } from '../../'
import { actionsSubscribe } from '../../../store'
import { observer } from 'mobx-react'

const styles = StyleSheet.create({
  container: {
    elevation: 8,
    borderRadius: 20,
    borderColor: secondary,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 5,
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

const ButtonPurchases = observer(() => {
  const { container } = styles

  const onSelection = async () => {}

  return (
    <TouchableOpacity onPress={onSelection} style={container}>
      {/* <Text h={'h7'} title={description} />
      <Text h={'h7'} title={I18n.t(description)} />
      <Space height={5} />
      <Text h={'h7'} title={price_string} /> */}
    </TouchableOpacity>
  )
})

export { ButtonPurchases }
