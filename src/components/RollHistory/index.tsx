import React, { memo, useMemo } from 'react'

import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { brightTurquoise, dimGray, white } from '../../constants'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../store'

const MAX_HISTORY = 7

const getHistory = (): {
  count: number
  plan: number
  status: string
  createDate: number
}[] => {
  if (DiceStore.online) {
    return OnlinePlayer.store.history || []
  }
  const playerIndex = DiceStore.players - 1
  return OfflinePlayers.store.histories[playerIndex] || []
}

export const RollHistory = memo(() => {
  const { t } = useTranslation()

  const history = getHistory()

  const rolls = useMemo(() => {
    return history.slice(0, MAX_HISTORY).reverse()
  }, [history])

  if (!rolls.length) return null

  return (
    <View style={styles.container}>
      <Text h="h11" textStyle={styles.label} title={t('rollHistory.title')} />
      <Space height={vs(4)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {rolls.map((item, index) => {
          const isLast = index === rolls.length - 1
          return (
            <View key={`${item.createDate}-${index}`} style={styles.row}>
              <View style={[styles.pill, isLast && styles.pillActive]}>
                <Text
                  h="h9"
                  textStyle={[styles.count, isLast && styles.countActive]}
                  title={`${item.count}`}
                />
              </View>
              <Space width={s(8)} />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    borderRadius: s(10),
    backgroundColor: 'rgba(80, 227, 194, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.35)'
  },
  label: {
    color: dimGray,
    textAlign: 'center',
    marginBottom: vs(2)
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: s(2)
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pill: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    backgroundColor: 'rgba(112, 112, 112, 0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillActive: {
    backgroundColor: brightTurquoise
  },
  count: {
    color: dimGray,
    fontWeight: '600'
  },
  countActive: {
    color: white
  }
})
