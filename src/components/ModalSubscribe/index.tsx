import React, { useEffect, useState } from 'react'
import { View, Modal } from 'react-native'
import { ScaledSheet } from 'react-native-size-matters'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { ButtonPurchases, ButtonSimple, Txt } from '../../components'
import { Space } from '../Space'
import { I18n } from '../../utils'
import { actionsSubscribe, SubscribeStore } from '../../store'
import { observer } from 'mobx-react-lite'

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)'
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    padding: 15
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  }
})

const ModalSubscribe = observer(() => {
  const [packages, setPackages] = useState<PurchasesPackage[]>([])

  useEffect(() => {
    const checkGame = async () => {
      try {
        const offerings = await Purchases.getOfferings()
        if (offerings.current !== null) {
          setPackages(offerings.current.availablePackages)
        }
      } catch (e) {
        console.log('e.message', e.message)
      }
    }

    checkGame()
  }, [])

  const { container, centeredView } = styles

  const sortPackages = packages.sort((a, b) => b.product.price - a.product.price)
  const visible = SubscribeStore.visible

  const restorePurchases = async () => {
    try {
      await Purchases.restoreTransactions()
      actionsSubscribe.setVisible(true)
    } catch (e) {
      // Alert.alert(e.message)
      console.log('e', e.message)
      // console.error(`e.message`, e.message)
    }
  }
  return (
    <Modal animationType="slide" transparent={true} visible={visible}>
      <View style={container}>
        <View style={centeredView}>
          <Txt h9 title={I18n.t('multi')} />
          <Space height={20} />
          {sortPackages.map(purchasesPackage => {
            return (
              <View key={purchasesPackage.identifier}>
                <ButtonPurchases purchasesPackage={purchasesPackage} />
                <Space height={10} />
              </View>
            )
          })}
          <Space height={10} />
          <ButtonSimple h="h8" title={I18n.t('hide')} onPress={() => actionsSubscribe.setVisible(false)} />
          <Space height={15} />
          <ButtonSimple h="h9" title={I18n.t('restore')} onPress={restorePurchases} />
        </View>
      </View>
    </Modal>
  )
})

export { ModalSubscribe }
