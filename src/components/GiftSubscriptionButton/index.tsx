import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import { Alert, Linking, Share, StyleSheet } from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'

import { Text } from '../../components'
import { captureException } from '../../constants'
import { SPACE, TOUCH, useTheme } from '../../theme'
import { Pressable } from '../Pressable'

interface GiftSubscriptionButtonT {
  selectedPackage: PurchasesPackage | null
}

const SUPPORT_EMAIL = 'reactnativeinitru@gmail.com'

export const GiftSubscriptionButton = memo(
  ({ selectedPackage }: GiftSubscriptionButtonT) => {
    const { t, i18n } = useTranslation()
    const palette = useTheme()

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
        {/*
          A single colour, or `Text` paints its gradient over this and the
          magenta comes back through the sheet's back door.
        */}
        <Text
          h="h4"
          oneColor={palette.accent}
          title={t('giftSubscription.title')}
          textStyle={styles.text}
        />
      </Pressable>
    )
  }
)

/**
 * The other way to buy, in the same colour as every other link here.
 *
 * It was `secondary` - the app's magenta - which on this screen made the gift
 * link louder than the purchase button beside it.
 */
const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginTop: SPACE.sm,
    minHeight: TOUCH,
    justifyContent: 'center'
  },
  text: {
    // No colour here: it arrives as `oneColor` from the palette, which is the
    // only form `Text` actually honours.
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  }
})
