import React from 'react'
import { Image, View } from 'react-native'
import { ScaledSheet, s, ms } from 'react-native-size-matters'
import { ICONS } from './images'
import { DiceStore, OnlinePlayer, OtherPlayers, OfflinePlayers } from '../../store'
import { observer } from 'mobx-react'

interface GemT {
  plan: number
  player: number
}

interface dataI {
  data: number
  id: number
  ava?: string
}

const Gem = observer(({ plan, player }: GemT) => {
  const getIndex = (num: number) => (num === player ? 2 : 1)

  const { container, gems } = styles

  const DATA: dataI[] = !DiceStore.online
    ? OfflinePlayers.store.plans
        .slice()
        .map((a, id) => {
          return {
            id: id + 1,
            data: a
          }
        })
        .slice(0, DiceStore.multi)
    : [
        { id: 1, data: OnlinePlayer.store.plan, ava: OnlinePlayer.store.avatar },
        ...OtherPlayers.store.online.slice().map((a, index) => {
          return {
            id: index + 2,
            data: a.plan,
            ava: a.avatar
          }
        })
      ]

  const source = (id: number, avatar: any) =>
    DiceStore.online ? { uri: avatar } : ICONS[id - 1]
  return (
    <View style={container}>
      {DATA.map(
        ({ data, id, ava }) =>
          data === plan && (
            <Image
              key={id}
              style={[
                gems,
                { position: 'absolute', zIndex: getIndex(id) },
                id === 1 && DiceStore.online && { zIndex: 2 }
              ]}
              source={source(id, ava)}
            />
          )
      )}
    </View>
  )
})

const styles = ScaledSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  gems: {
    width: ms(42, 0.5),
    height: ms(42, 0.5),
    borderRadius: ms(42, 0.5) / 2
  }
})

export { Gem }
