import React, { memo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'
import { s } from 'react-native-size-matters'

import { Text } from '../../components'
import { secondary } from '../../constants'
import { Pressable } from '../Pressable'

interface PayWhatYouWantOptionT {
  selectedPackage: PurchasesPackage | null
}

const EMERGING_MARKET_LANGUAGES = ['ru', 'uk', 'tr', 'ar', 'bn', 'mr', 'ms', 'te']

const TIERS = [
  { key: 'minimum', labelKey: 'payWhatYouWant.minimum' },
  { key: 'balanced', labelKey: 'payWhatYouWant.balanced' },
  { key: 'generous', labelKey: 'payWhatYouWant.generous' }
]

export const PayWhatYouWantOption = memo(({ selectedPackage }: PayWhatYouWantOptionT) => {
  const { t, i18n } = useTranslation()
  const [activeTier, setActiveTier] = useState<string | null>(null)

  const isEmergingMarket = EMERGING_MARKET_LANGUAGES.includes(i18n.language)
  const isAnnual = selectedPackage?.identifier === '$rc_annual'

  if (!isAnnual || !isEmergingMarket) {
    return null
  }

  return (
    <View style={styles.container}>
      <Text h="h4" textStyle={styles.title} title={t('payWhatYouWant.title')} />
      <Text h="h0" textStyle={styles.subtitle} title={t('payWhatYouWant.subtitle')} />
      <View style={styles.tiers}>
        {TIERS.map((tier) => (
          <Pressable
            key={tier.key}
            onPress={() => setActiveTier(tier.key)}
            style={[styles.tier, activeTier === tier.key && styles.activeTier]}
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
          title={t('payWhatYouWant.selected', { tier: t(`payWhatYouWant.${activeTier}`) })}
        />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginTop: s(12),
    width: s(280)
  },
  title: {
    color: secondary,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  subtitle: {
    color: secondary,
    marginTop: s(4),
    textAlign: 'center'
  },
  tiers: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: s(10)
  },
  tier: {
    borderColor: secondary,
    borderRadius: s(6),
    borderWidth: 1,
    marginHorizontal: s(4),
    paddingHorizontal: s(10),
    paddingVertical: s(6)
  },
  activeTier: {
    backgroundColor: secondary
  },
  tierText: {
    color: secondary
  },
  activeTierText: {
    color: '#FFFFFF'
  },
  selected: {
    color: secondary,
    marginTop: s(8),
    textAlign: 'center'
  }
})
