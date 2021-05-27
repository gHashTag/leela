import React from 'react'
import { Image, View } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'
import { ICONS } from './images'
import {
  PlayerOneStore,
  PlayerTwoStore,
  PlayerThreeStore,
  PlayerFourStore,
  PlayerFiveStore,
  PlayerSixStore,
  DiceStore
} from '../../store'

interface GemT {
  plan: number
  player: number
}

const Gem = ({ plan, player }: GemT) => {
  const getIndex = (num: number) => (num === player ? 2 : 1)

  const { container, gems } = styles

  const DATA = [
    {
      id: 1,
      data: PlayerOneStore.plan
    },
    { id: 2, data: PlayerTwoStore.plan },
    { id: 3, data: PlayerThreeStore.plan },
    { id: 4, data: PlayerFourStore.plan },
    { id: 5, data: PlayerFiveStore.plan },
    { id: 6, data: PlayerSixStore.plan }
  ].slice(0, DiceStore.multi)

  return (
    <View style={container}>
      {DATA.map(
        ({ data, id }) =>
          data === plan && (
            <Image key={id} style={[gems, { position: 'absolute', zIndex: getIndex(id) }]} source={ICONS[id]} />
          )
      )}
    </View>
  )
}

const styles = ScaledSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  gems: {
    width: s(42),
    height: s(42)
  }
})

export { Gem }
