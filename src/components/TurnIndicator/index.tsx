import { observer } from 'mobx-react'
import React, { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { dimGray, primary } from '../../constants'
import { DiceStore, OnlinePlayer } from '../../store'
import { triggerHaptic } from '../../utils/haptics'
import { announceForAccessibility } from '../../utils/accessibilityAnnouncements'
import { useReducedMotion } from '../../utils/useReducedMotion'

export const TurnIndicator = observer(() => {
  const { t } = useTranslation()
  const prevPlayerRef = useRef(DiceStore.players)

  const online = DiceStore.online
  const player = DiceStore.players
  const reducedMotion = useReducedMotion()
  const isOnlineBlocked =
    online && (!OnlinePlayer.store.isReported || !OnlinePlayer.store.canGo)

  const label = online
    ? OnlinePlayer.store.isReported
      ? t('takeStep')
      : t('online-part.notReported')
    : t('playerTurn')

  const detail = online
    ? OnlinePlayer.store.isReported
      ? OnlinePlayer.store.timeText
        ? `${t('nextStep')}: ${OnlinePlayer.store.timeText}`
        : ''
      : ''
    : `#${player}`

  useEffect(() => {
    if (player !== prevPlayerRef.current) {
      if (!reducedMotion) triggerHaptic('impactLight')
      announceForAccessibility(
        t('accessibilityAnnouncements.playerTurn', { player })
      )
      prevPlayerRef.current = player
    }
  }, [player, t, reducedMotion])

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label} ${detail}`}
      accessibilityLiveRegion="polite"
      testID="turn-indicator"
    >
      <View style={[styles.dot, isOnlineBlocked && styles.dotBlocked]} />
      <Space width={s(8)} />
      <Text h="h8" title={label} oneColor={primary} textStyle={styles.label} />
      <Space width={s(6)} />
      <Text
        h="h8"
        title={detail}
        oneColor={dimGray}
        textStyle={styles.detail}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(6)
  },
  dot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: primary
  },
  dotBlocked: {
    backgroundColor: dimGray
  },
  label: {
    fontWeight: '600'
  },
  detail: {
    fontWeight: '500'
  }
})
