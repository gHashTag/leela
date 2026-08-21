import React, { memo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'

import { Text } from '../../components'
import { RADIUS, SPACE, TOUCH, useTheme, type Palette } from '../../theme'
import { Pressable } from '../Pressable'

interface PayWhatYouWantOptionT {
  selectedPackage: PurchasesPackage | null
}

const EMERGING_MARKET_LANGUAGES = [
  'ru',
  'uk',
  'tr',
  'ar',
  'bn',
  'mr',
  'ms',
  'te'
]

const TIERS = [
  { key: 'minimum', labelKey: 'payWhatYouWant.minimum' },
  { key: 'balanced', labelKey: 'payWhatYouWant.balanced' },
  { key: 'generous', labelKey: 'payWhatYouWant.generous' }
]

export const PayWhatYouWantOption = memo(
  ({ selectedPackage }: PayWhatYouWantOptionT) => {
    const { t, i18n } = useTranslation()
    const [activeTier, setActiveTier] = useState<string | null>(null)
    // Above the early return below, which is a condition like any other. This
    // component returns `null` for most players, so a hook placed after it
    // would run on some renders and not others.
    const palette = useTheme()
    const styles = React.useMemo(() => stylesFor(palette), [palette])

    const isEmergingMarket = EMERGING_MARKET_LANGUAGES.includes(i18n.language)
    const isAnnual = selectedPackage?.identifier === '$rc_annual'

    if (!isAnnual || !isEmergingMarket) {
      return null
    }

    return (
      <View style={styles.container}>
        <Text
          h="h4"
          textStyle={styles.title}
          title={t('payWhatYouWant.title')}
        />
        <Text
          h="h0"
          textStyle={styles.subtitle}
          title={t('payWhatYouWant.subtitle')}
        />
        <View style={styles.tiers}>
          {TIERS.map((tier) => (
            <Pressable
              key={tier.key}
              onPress={() => setActiveTier(tier.key)}
              style={[
                styles.tier,
                activeTier === tier.key && styles.activeTier
              ]}
            >
              <Text
                h="h0"
                textStyle={[
                  styles.tierText,
                  activeTier === tier.key && styles.activeTierText
                ]}
                title={t(tier.labelKey)}
              />
            </Pressable>
          ))}
        </View>
        {activeTier && (
          <Text
            h="h0"
            textStyle={styles.selected}
            title={t('payWhatYouWant.selected', {
              tier: t(`payWhatYouWant.${activeTier}`)
            })}
          />
        )}
      </View>
    )
  }
)

/**
 * Choose-your-price, in the app's own colours.
 *
 * Every line of it was magenta on whatever the paywall happened to be, and the
 * chosen tier printed `#FFFFFF` on that magenta - a pair that exists in neither
 * scheme. It sits directly under the list of prices, so it was the one block on
 * the page that did not follow the phone.
 */
const stylesFor = (palette: Palette) =>
  StyleSheet.create({
    container: {
      alignSelf: 'stretch',
      marginTop: SPACE.sm
    },
    title: {
      color: palette.text,
      fontWeight: 'bold',
      textAlign: 'center'
    },
    subtitle: {
      color: palette.hint,
      marginTop: SPACE.xs,
      textAlign: 'center'
    },
    tiers: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: SPACE.sm
    },
    tier: {
      borderColor: palette.rule,
      borderRadius: RADIUS,
      borderWidth: 1,
      marginHorizontal: SPACE.xs / 2,
      paddingHorizontal: SPACE.sm,
      minHeight: TOUCH,
      justifyContent: 'center'
    },
    activeTier: {
      // Chosen, in the colour this app uses for a live control - the same mark
      // the selected price row above it carries.
      backgroundColor: palette.accent,
      borderColor: palette.accent
    },
    tierText: {
      color: palette.text
    },
    activeTierText: {
      color: palette.onAccent
    },
    selected: {
      color: palette.hint,
      marginTop: SPACE.sm,
      textAlign: 'center'
    }
  })
