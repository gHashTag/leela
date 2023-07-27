import { useTheme } from '@react-navigation/native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Emoji from 'react-native-emoji'
import { PurchasesPackage } from 'react-native-purchases'
import { ms, s } from 'react-native-size-matters'
import { Loading, PurchaseButton, Space, Spin, Text } from 'src/components'
import {
  black,
  captureException,
  goBack,
  gray,
  secondary,
  white,
} from 'src/constants'

import { useRevenueCat } from '../../providers/RevenueCatProvider'
// @ts-ignore
import Ganesha from './ganesha.jpg'

const SubscriptionScreen: React.FC = () => {
  const { t } = useTranslation()
  const { packages, purchasePackage, restorePermissions } = useRevenueCat()
  const { isLoading } = useRevenueCat()
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null)
  const [purchaseSuccessful, setPurchaseSuccessful] = useState(false)

  const handlePackageSelection = (pack: PurchasesPackage) => {
    setSelectedPackage(pack)
  }

  const handlePurchase = async () => {
    if (purchasePackage && selectedPackage) {
      try {
        await purchasePackage(selectedPackage)
        setPurchaseSuccessful(true)
        goBack()
      } catch (error) {
        setPurchaseSuccessful(false)
        captureException(error, 'handlePurchase')
      }
    }
  }

  const onPress = () => goBack()

  const onAlreadyBought = async () => {
    try {
      if (restorePermissions) {
        await restorePermissions()
      }
    } catch (error) {
      captureException(error, 'onAlreadyBought')
    }
  }
  const { dark } = useTheme()
  const backgroundColor = dark ? black : white

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <ImageBackground style={styles.poster} source={Ganesha}>
        <Pressable onPress={onPress} style={styles.iconStyle}>
          <Emoji name=":heavy_multiplication_x:" style={styles.leftIconStyle} />
        </Pressable>
      </ImageBackground>

      <View style={styles.container}>
        <Text
          h="h4"
          textStyle={styles.test}
          title={t('descriptionSubscriptions')}
        />
        <Text
          h="h1"
          textStyle={styles.header}
          title={t('chooseSubscription')}
        />
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {packages.map((pack) => (
              <TouchableOpacity
                key={pack.identifier}
                onPress={() => handlePackageSelection(pack)}
                style={[
                  styles.packageItem,
                  selectedPackage === pack && styles.selectedPackage,
                ]}
              >
                <Text
                  h="h0"
                  textStyle={styles.packageTitle}
                  title={t(`${[pack.identifier]}.title`)}
                />
                <Text
                  h="h0"
                  textStyle={styles.packagePrice}
                  title={pack.product.priceString}
                />
              </TouchableOpacity>
            ))}
          </>
        )}

        <PurchaseButton
          title="buy"
          selectedPackage={selectedPackage}
          onPress={handlePurchase}
        />
        <Text
          h="h4"
          textStyle={styles.bought}
          title={t('alreadyBought')}
          onPress={onAlreadyBought}
        />
        <Space height={50} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  poster: {
    flex: 1,
    width: '100%',
    height: '90%',
  },
  iconStyle: {
    marginTop: 60,
    marginLeft: 20,
  },
  leftIconStyle: {
    fontSize: ms(30, 0.6),
  },
  header: {
    fontSize: ms(23, 0.6),
    fontWeight: 'bold',
    marginBottom: 20,
  },
  bought: {
    top: 10,
    fontSize: ms(13, 0.6),
    fontWeight: 'bold',
    color: gray,
    alignSelf: 'center',
    textDecorationLine: 'underline',
  },
  test: {
    fontSize: ms(15, 0.6),
    fontWeight: 'bold',
    alignSelf: 'center',
    textAlign: 'center',
    width: '80%',
    bottom: 30,
  },
  packageItem: {
    borderWidth: 1,
    borderColor: secondary,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedPackage: {
    backgroundColor: '#e0e0e0',
  },
  packageTitle: {
    fontSize: ms(21, 0.6),
    fontWeight: 'bold',
  },
  packagePrice: {
    fontSize: ms(23, 0.6),
  },
  purchaseButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  disabledButton: {
    width: s(200),
    backgroundColor: secondary,
  },
  buttonText: {
    color: '#fff',
    fontSize: s(30),
    fontWeight: 'bold',
    width: s(200),
    textAlign: 'center',
    alignSelf: 'center',
  },
})

export { SubscriptionScreen }
