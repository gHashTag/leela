import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import { Alert, Linking, Share, StyleSheet } from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'
import { s } from 'react-native-size-matters'

import { Text } from '../../components'
import { captureException, secondary } from '../../constants'
import { Pressable } from '../Pressable'

interface GiftSubscriptionButtonT {
  selectedPackage: PurchasesPackage | null
}

const SUPPORT_EMAIL = 'reactnativeinitru@gmail.com'

export const GiftSubscriptionButton = memo(({ selectedPackage }: GiftSubscriptionButtonT) => {
  const { t, i18n } = useTranslation()

  const handleGift = async () => {
    const packageTitle = selectedPackage
      ? t(`${selectedPackage.identifier}.title`)
      : t('giftSubscription.defaultPackageTitle')
    const price = selectedPackage?.product?.priceString || ''

    const message = t('giftSubscription.shareMessage', {
      package: packageTitle,
      price
    })

    try {
      const result = await Share.share({
        title: t('giftSubscription.shareTitle'),
        message
      })

      if (result.action === Share.sharedAction) {
        // After sharing, offer a direct email path to complete the gift.
        Alert.alert(
          t('giftSubscription.sendAlertTitle'),
          t('giftSubscription.sendAlertMessage'),
          [
            { text: t('giftSubscription.later'), style: 'cancel' },
            {
              text: t('giftSubscription.contactSupport'),
              onPress: () => sendSupportEmail(packageTitle, price)
            }
          ]
        )
      }
    } catch (error) {
      captureException(error, 'GiftSubscriptionButton: share')
    }
  }

  const sendSupportEmail = async (packageTitle: string, price: string) => {
    const subject = encodeURIComponent(
      t('giftSubscription.emailSubject', { package: packageTitle })
    )
    const body = encodeURIComponent(
      t('giftSubscription.emailBody', {
        package: packageTitle,
        price,
        language: i18n.language
      })
    )
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    try {
      await Linking.openURL(mailto)
    } catch (error) {
      captureException(error, 'GiftSubscriptionButton: email fallback')
    }
  }

  return (
    <Pressable onPress={handleGift} style={styles.container}>
      <Text
        h="h4"
        title={t('giftSubscription.title')}
        textStyle={styles.text}
      />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginTop: s(8)
  },
  text: {
    color: secondary,
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  }
})
