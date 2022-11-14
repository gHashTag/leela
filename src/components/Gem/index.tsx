import React from 'react'

import { observer } from 'mobx-react'
import { Image, Pressable, View } from 'react-native'
import { ScaledSheet, ms } from 'react-native-size-matters'

import { ICONS } from './images'

import { DiceStore, OfflinePlayers, OnlinePlayer, OtherPlayers } from '../../store'
import { useTypedNavigation } from 'src/hooks'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

interface GemT {
  plan: number
  player: number
}

interface dataI {
  data: number
  id: number
  ava?: string
  ownerId?: string
}

const Gem = observer(({ plan, player }: GemT) => {
  const getIndex = (num: number) => (num === player ? 2 : 1)
  const { navigate } = useTypedNavigation()
  const { container, gems } = styles

  const DATA: dataI[] = !DiceStore.online
    ? OfflinePlayers.store.plans
        .slice()
        .map((a, id) => {
          return {
            id: id + 1,
            data: a,
          }
        })
        .slice(0, DiceStore.multi)
    : [
        { id: 1, data: OnlinePlayer.store.plan, ava: OnlinePlayer.store.avatar },
        ...OtherPlayers.store.online.slice().map((a, index) => {
          return {
            id: index + 2,
            data: a.plan,
            ava: a.avatar,
            ownerId: a.owner,
          }
        }),
      ]

  const source = (id: number, avatar: any) =>
    DiceStore.online ? { uri: avatar } : ICONS[id - 1]
  return (
    <View style={container}>
      {DATA.map(({ data, id, ava, ownerId }) => {
        const onPressAva = () => {
          ownerId && navigate('USER_PROFILE_SCREEN', { ownerId })
        }

        if (data === plan) {
          return (
            <GestureDetector
              gesture={Gesture.Tap().onTouchesUp(() => runOnJS(onPressAva)())}
              key={id}
            >
              <Image
                style={[
                  gems,
                  { zIndex: getIndex(id) },
                  id === 1 && DiceStore.online && { zIndex: 2 },
                ]}
                source={source(id, ava)}
              />
            </GestureDetector>
          )
        } else return <></>
      })}
    </View>
  )
})

const styles = ScaledSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gems: {
    width: ms(42, 0.5),
    height: ms(42, 0.5),
    borderRadius: ms(42, 0.5) / 2,
  },
})

export { Gem }
