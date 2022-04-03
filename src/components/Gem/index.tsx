import React from 'react'
import { Image, View } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'
import { ICONS } from './images'
import {
  PlayersStore,
  DiceStore,
  OnlinePlayerStore,
  OnlineOtherPlayers
} from '../../store'

interface GemT {
  plan: number
  player: number
}

const Gem = ({ plan, player }: GemT) => {
  const getIndex = (num: number) => (num === player ? 2 : 1)

  const { container, gems } = styles

  const DATA = !DiceStore.online ? [
    { id: 1, data: PlayersStore.plans[0] },
    { id: 2, data: PlayersStore.plans[1] },
    { id: 3, data: PlayersStore.plans[2] },
    { id: 4, data: PlayersStore.plans[3] },
    { id: 5, data: PlayersStore.plans[4] },
    { id: 6, data: PlayersStore.plans[5] }
  ].slice(0, DiceStore.multi) : [
    { id: 1, data: OnlinePlayerStore.plan, ava: OnlinePlayerStore.avatar },
    ...OnlineOtherPlayers.players.slice().map((a, index) => {
    return{
      id: index+2,
      data: a.plan,
      ava: a.avatar
    }})
  ]

  const source = (id: number, avatar: any) => (DiceStore.online ? { uri: avatar } : ICONS[id-1])
  return (
    <View style={container}>
      {DATA.map(
        ({ data, id, ava }) =>
          data === plan && (
            <Image key={id} style={[gems, { position: 'absolute', zIndex: getIndex(id) },
             (id === 1 && DiceStore.online) && {zIndex: 2}]} source={source(id, ava)}
             />
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
    height: s(42),
    borderRadius: s(42) / 2
  }
})

export { Gem }
