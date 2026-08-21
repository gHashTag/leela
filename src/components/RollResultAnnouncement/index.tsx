import { observer } from 'mobx-react'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { brightTurquoise, dimGray } from '../../constants'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../store'
import { triggerHaptic } from '../../utils/haptics'
import { announceForAccessibility } from '../../utils/accessibilityAnnouncements'
import { useReducedMotion } from '../../utils/useReducedMotion'

const FADE_MS = 1800

export const RollResultAnnouncement = observer(() => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const lastCountRef = useRef(DiceStore.count)
  const reducedMotion = useReducedMotion()

  const history = DiceStore.online
    ? OnlinePlayer.store.history
    : OfflinePlayers.store.histories[DiceStore.players - 1]

  const lastMove = history && history.length > 0 ? history[0] : null

  const message = useMemo(() => {
    if (!lastMove) return ''
    const { count, plan } = lastMove
    const from = Math.max(1, plan - count)
    return t('rollResult.message', {
      count,
      from,
      to: plan,
      defaultValue: `Rolled ${count}: ${from} → ${plan}`
    }) as string
  }, [lastMove, t])

  useEffect(() => {
    if (DiceStore.count !== lastCountRef.current && lastMove) {
      lastCountRef.current = DiceStore.count
      if (!reducedMotion) triggerHaptic('impactLight')
      announceForAccessibility(message)
      setVisible(true)
      const timer = setTimeout(
        () => setVisible(false),
        reducedMotion ? FADE_MS / 2 : FADE_MS
      )
      return () => clearTimeout(timer)
    }
  }, [DiceStore.count, lastMove, message, reducedMotion])

  if (!message) return null

  return (
    <View
      style={[
        styles.container,
        !visible && (reducedMotion ? styles.noMotionHidden : styles.hidden)
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      testID="roll-result-announcement"
    >
      <Text
        h="h8"
        title={message}
        oneColor={brightTurquoise}
        textStyle={styles.text}
      />
      <Space height={vs(4)} />
      <Text
        h="h11"
        title={t('rollResult.hint', {
          defaultValue: 'The board moves with the result.'
        })}
        oneColor={dimGray}
        textStyle={styles.hint}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: s(16),
    marginTop: vs(8),
    opacity: 1
  },
  hidden: {
    opacity: 0
  },
  noMotionHidden: {
    display: 'none'
  },
  text: {
    textAlign: 'center',
    fontWeight: '600'
  },
  hint: {
    textAlign: 'center'
  }
})
