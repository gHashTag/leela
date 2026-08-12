import React, { useRef, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  ToastAndroid,
  View
} from 'react-native'

import { vs } from 'react-native-size-matters'

import { Text } from '../../components'
import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  actionsDice
} from '../../store'
import { playDiceSound } from '../../utils/soundEffects'
import { minTouchTarget } from '../../utils/hitTarget'
import { triggerHaptic } from '../../utils/haptics'
import { useReducedMotion } from '../../utils/useReducedMotion'

const getImage = (number: number) => {
  // don`t working return require(`./assets/${number}.png`)
  switch (number) {
    case 1:
      return require('./assets/1.png')
    case 2:
      return require('./assets/2.png')
    case 3:
      return require('./assets/3.png')
    case 4:
      return require('./assets/4.png')
    case 5:
      return require('./assets/5.png')
    case 6:
      return require('./assets/6.png')
  }
}

type DiceT = {
  disabled?: boolean
}

export const Dice = observer(({ disabled }: DiceT) => {
  const [canRoll, setCanRoll] = useState<boolean>(true)
  const spinValue = useRef(new Animated.Value(0)).current
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation()

  const handleSpin = (value: number) => {
    if (reducedMotion) {
      triggerHaptic('impactLight')
      DiceStore.online
        ? OnlinePlayer.updateStep()
        : OfflinePlayers.updateStep(DiceStore.players - 1)
      setTimeout(() => setCanRoll(true), 200)
      return
    }
    const duration = (value / 2) * 500
    spinValue.setValue(0)
    Animated.timing(spinValue, {
      toValue: value,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true
    }).start(() => {
      triggerHaptic('impactLight')
      DiceStore.online
        ? OnlinePlayer.updateStep()
        : OfflinePlayers.updateStep(DiceStore.players - 1)
      setTimeout(() => setCanRoll(true), 200)
    })
  }
  const isOpacity =
    (!OnlinePlayer.store.canGo && DiceStore.online) ||
    (DiceStore.online && !OnlinePlayer.store.isReported)
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  const showLockedMessage = () => {
    const message = OnlinePlayer.store.isReported
      ? t('online-part.stepLocked', {
          time: OnlinePlayer.store.timeText
        })
      : t('online-part.notReported')
    triggerHaptic('notificationWarning')
    if (ToastAndroid) {
      ToastAndroid.showWithGravityAndOffset(
        message,
        ToastAndroid.LONG,
        ToastAndroid.BOTTOM,
        25,
        50
      )
    }
  }

  const rollDice = (): void => {
    if (isOpacity) {
      showLockedMessage()
      return
    }
    setCanRoll(false)
    actionsDice.random()
    triggerHaptic('impactMedium')
    playDiceSound()
    handleSpin(DiceStore.count)
  }

  const lockedHint = OnlinePlayer.store.isReported
    ? t('accessibility.diceLockedHint')
    : t('online-part.notReported')

  return (
    <View style={styles.container} accessible={false}>
      <Pressable
        onPress={() => {
          canRoll && rollDice()
        }}
        style={[minTouchTarget, styles.diceContainer, isOpacity && styles.opacityCube]}
        disabled={disabled}
        accessible
        accessibilityRole="button"
        testID="dice-roll"
        accessibilityLabel={
          isOpacity
            ? t('accessibility.diceLocked')
            : t('accessibility.rollDiceValue', { count: DiceStore.count })
        }
        accessibilityHint={isOpacity ? lockedHint : t('accessibility.rollDiceHint')}
        accessibilityState={{ disabled: isOpacity || disabled || !canRoll }}
        accessibilityActions={[
          { name: 'activate', label: t('accessibility.rollDice') }
        ]}
      >
        <Animated.Image
          style={[styles.image, { transform: [{ rotate: spin }] }]}
          source={getImage(DiceStore.count)}
          accessible={false}
          importantForAccessibility="no"
        />
      </Pressable>
      {isOpacity && (
        <Text
          h="h6"
          testID="dice-locked-text"
          title={
            OnlinePlayer.store.isReported
              ? t('online-part.waitForNextStep')
              : t('online-part.notReported')
          }
          textStyle={styles.lockedText}
        />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: vs(12)
  },
  diceContainer: {
    alignItems: 'center',
    alignSelf: 'center'
  },
  image: {
    height: vs(65),
    width: vs(65)
  },
  opacityCube: {
    opacity: 0.4
  },
  lockedText: {
    marginTop: vs(6),
    textAlign: 'center',
    opacity: 0.7
  }
})
