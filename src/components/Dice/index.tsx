import React, { useRef, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  ToastAndroid,
  Vibration,
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
  const { t } = useTranslation()

  const handleSpin = (value: number) => {
    const duration = (value / 2) * 500
    spinValue.setValue(0)
    Animated.timing(spinValue, {
      toValue: value,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true
    }).start(() => {
      Vibration.vibrate(30)
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
    Vibration.vibrate(50)
    handleSpin(DiceStore.count)
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          canRoll && rollDice()
        }}
        style={[styles.diceContainer, isOpacity && styles.opacityCube]}
        disabled={disabled}
      >
        <Animated.Image
          style={[styles.image, { transform: [{ rotate: spin }] }]}
          source={getImage(DiceStore.count)}
        />
      </Pressable>
      {isOpacity && (
        <Text
          h="h6"
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
