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
import { Spin, Text } from 'src/components'
import { black, goBack, primary, secondary, white } from 'src/constants'

import { useRevenueCat } from '../../providers/RevenueCatProvider'
import Ganesha from './ganesha.jpg'

const SubscriptionScreen: React.FC = () => {
  const { t } = useTranslation()
  const { packages, purchasePackage } = useRevenueCat()
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

  return (
    <View style={styles.root}>
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
              title={pack.product.title}
            />
            <Text
              h="h0"
              textStyle={styles.packagePrice}
              title={pack.product.priceString}
            />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={!selectedPackage}
          style={[
            styles.purchaseButton,
            !selectedPackage && styles.disabledButton,
          ]}
        >
          <Text h="h0" textStyle={styles.buttonText} title={t('buy')} />
        </TouchableOpacity>
        <Text h="h4" textStyle={styles.bought} title={t('alreadyBought')} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: white,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: white,
  },
  poster: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: white,
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
    top: 20,
    fontSize: 13,
    fontWeight: 'bold',
    color: black,
    alignSelf: 'center',
  },
  test: {
    fontSize: 15,
    fontWeight: 'bold',
    color: black,
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
    backgroundColor: secondary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    width: 100,
    textAlign: 'center',
  },
})

export { SubscriptionScreen }
