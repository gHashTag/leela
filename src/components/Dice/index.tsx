import React, { useRef, useState } from 'react'

import { observer } from 'mobx-react'
import { Animated, Easing, Pressable, StyleSheet } from 'react-native'

import { vs } from 'react-native-size-matters'

import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  actionsDice
} from '../../store'

const getImage = (number: number) => {
  // так не работает
  // return require(`./assets/${number}.png`)
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

export const Dice = observer(() => {
  const [canRoll, setCanRoll] = useState<boolean>(true)
  const spinValue = useRef(new Animated.Value(0)).current

  const handleSpin = (value: number) => {
    const duration = (value / 2) * 500
    spinValue.setValue(0)
    Animated.timing(spinValue, {
      toValue: value,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true
    }).start(() => {
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

  const rollDice = (): void => {
    if (isOpacity) {
      return
    }
    setCanRoll(false)
    actionsDice.random()
    handleSpin(DiceStore.count)
  }

  return (
    <Pressable
      onPress={() => {
        canRoll && rollDice()
      }}
      style={[styles.diceContainer, isOpacity && styles.opacityCube]}
    >
      <Animated.Image
        style={[styles.image, { transform: [{ rotate: spin }] }]}
        source={getImage(DiceStore.count)}
      />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  diceContainer: {
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: vs(12)
  },
  image: {
    height: vs(65),
    width: vs(65)
  },
  opacityCube: {
    opacity: 0.4
  }
})
