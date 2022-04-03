import React, { useEffect } from 'react'
import { StyleSheet, Pressable, Platform } from 'react-native'
import ShakeEvent from 'react-native-shake'
import { Cube } from './Cube'
import { observer } from 'mobx-react-lite'
import withPreventDoubleClick from './withPreventDoubleClick'
import { DiceStore, actionsDice, OnlinePlayerStore } from '../../store'
import { s } from 'react-native-size-matters'

const ButtonEx = withPreventDoubleClick(Pressable)

const styles = StyleSheet.create({
  diceContainer: {
    position: 'absolute',
    alignItems: 'center',
    alignSelf: 'center',
    top: Platform.OS === 'ios' ? s(20) : s(35)
  }
})

const Dice = observer(() => {
  useEffect(() => {
    ShakeEvent.addEventListener('ShakeEvent', () => rollDice())
    return function cleanup() {
      ShakeEvent.removeEventListener('ShakeEvent', () => {})
    }
  }, [])

  const rollDice = () => {
    if (!OnlinePlayerStore.canGo && DiceStore.online) {
      return
    }
    actionsDice.random()
  }

  return (
    <ButtonEx onPress={rollDice} style={[styles.diceContainer, 
     (!OnlinePlayerStore.canGo && DiceStore.online) && {opacity: 0.4}]}>
      <Cube duration={DiceStore.count} />
    </ButtonEx>
  )
})

export { Dice }
