import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Pressable, Platform, Animated, Easing } from 'react-native'
import ShakeEvent from 'react-native-shake'
import { observer } from 'mobx-react-lite'
import { DiceStore, actionsDice, OnlinePlayer, OfflinePlayers } from '../../store'
import { s, ms } from 'react-native-size-matters'

const styles = StyleSheet.create({
  diceContainer: {
    position: 'absolute',
    alignItems: 'center',
    alignSelf: 'center',
    top: Platform.OS === 'ios' ? s(20) : s(35)
  },
  image: {
    height: ms(65, 0.4),
    width: ms(65, 0.4),
    margin: 30
  }
})

const getImage = (number: number) => {
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

const Dice = observer(() => {
  const [canRoll, setCanRoll] = useState<boolean>(true)
  const spinValue = useRef(new Animated.Value(0)).current
  useEffect(() => {
    ShakeEvent.addEventListener('ShakeEvent', () => rollDice())
    return () => {
      ShakeEvent.removeEventListener('ShakeEvent', () => {})
    }
  }, [])

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

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  const rollDice = (): void => {
    if (!OnlinePlayer.store.canGo && DiceStore.online) {
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
      style={[
        styles.diceContainer,
        !OnlinePlayer.store.canGo && DiceStore.online && { opacity: 0.4 }
      ]}
    >
      <Animated.Image
        style={[styles.image, { transform: [{ rotate: spin }] }]}
        source={getImage(DiceStore.count)}
      />
    </Pressable>
  )
})

export { Dice }
