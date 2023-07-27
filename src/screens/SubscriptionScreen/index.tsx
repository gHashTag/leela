import { useTheme } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Emoji from 'react-native-emoji'
import { PurchasesPackage } from 'react-native-purchases'
import { PurchaseButton, Spin, Text } from 'src/components'
import {
  black,
  captureException,
  goBack,
  gray,
  primary,
  secondary,
  white,
} from 'src/constants'

import { useRevenueCat } from '../../providers/RevenueCatProvider'
// @ts-ignore
import Ganesha from './ganesha.jpg'

const SubscriptionScreen: React.FC = () => {
  const { t } = useTranslation()
  const { packages, purchasePackage, restorePermissions } = useRevenueCat()
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null)

  useEffect(() => {
    setLoading(false)
  }, [])

  const handlePackageSelection = (pack: PurchasesPackage) => {
    setSelectedPackage(pack)
  }

  const handlePurchase = async () => {
    if (purchasePackage && selectedPackage) {
      await purchasePackage(selectedPackage)
    }
  }

  if (loading) {
    return <Spin />
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
              title={pack.product.priceString.slice(0, 4)}
            />
          </TouchableOpacity>
        ))}

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
    height: '95%',
  },
  iconStyle: {
    marginTop: 60,
    marginLeft: 20,
  },
  leftIconStyle: {
    fontSize: 30,
  },
  header: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  bought: {
    top: 10,
    fontSize: 13,
    fontWeight: 'bold',
    color: gray,
    alignSelf: 'center',
  },
  test: {
    fontSize: 15,
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
    fontSize: 23,
    fontWeight: 'bold',
  },
  packagePrice: {
    fontSize: 26,
  },
  purchaseButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  disabledButton: {
    width: 200,
    backgroundColor: secondary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    width: 200,
    textAlign: 'center',
    alignSelf: 'center',
  },
})

export { SubscriptionScreen }
