import React, { useEffect, useRef } from 'react'
import { StyleSheet, Pressable, Platform, Animated, Easing } from 'react-native'
import ShakeEvent from 'react-native-shake'
import { observer } from 'mobx-react-lite'
import withPreventDoubleClick from './withPreventDoubleClick'
import { DiceStore, actionsDice, OnlinePlayerStore, actionPlayers } from '../../store'
import { s, ms } from 'react-native-size-matters'

const ButtonEx = withPreventDoubleClick(Pressable)

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
      break
    case 2:
      return require('./assets/2.png')
      break
    case 3:
      return require('./assets/3.png')
      break
    case 4:
      return require('./assets/4.png')
      break
    case 5:
      return require('./assets/5.png')
      break
    case 6:
      return require('./assets/6.png')
      break
  }
}

const Dice = observer(() => {
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
    }).start(() => actionPlayers.updateStep(DiceStore.players-1))
  }
    
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  const rollDice = (): void => {
    if (!OnlinePlayerStore.canGo && DiceStore.online) {
      return
    }
    actionsDice.random()
    handleSpin(DiceStore.count)
  }

  return (
    <ButtonEx onPress={rollDice} style={[styles.diceContainer, 
     (!OnlinePlayerStore.canGo && DiceStore.online) && {opacity: 0.4}]}>
      <Animated.Image style={[styles.image, { transform: [{ rotate: spin }] }]} source={getImage(DiceStore.count)} />
    </ButtonEx>
  )
})

export { Dice }
