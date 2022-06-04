import React from 'react'
import { ImageBackground, StyleSheet, useColorScheme, View } from 'react-native'
import { ICONS } from './images'
import { observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'
import { H, W } from '../../constants'
import { Gem } from '../Gem'
import { Text } from '../'
import { DiceStore, OfflinePlayers, OnlinePlayer, OtherPlayers } from '../../store'

const ratio = W / 714
const marginTop = H - W > 350 ? 20 : 0

const styles = StyleSheet.create({
  container: {
    flex: 1,
    top: s(15),
    alignItems: 'center',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row'
  },
  img: {
    width: W,
    height: 620 * ratio,
    marginTop
  },
  box: {
    width: s(31),
    height: s(31),
    marginVertical: s(2.1),
    marginHorizontal: s(1.0),
    alignItems: 'center',
    justifyContent: 'center'
  }
})

const GameBoard = observer(() => {
  const arr = !DiceStore.online
    ? OfflinePlayers.store.plans
        .slice()
        .map(a => {
          return {
            plan: a
          }
        })
        .slice(0, DiceStore.multi)
    : [
        {
          mainPlayer: true,
          plan: OnlinePlayer.store.plan
        },
        ...OtherPlayers.store.online.slice().map((a: any) => {
          return { plan: a.plan }
        })
      ]

  const getPlan = (x: number) => arr.filter(y => y.plan === x)
  const { img, container, row, box } = styles
  const scheme = useColorScheme()
  const source = () =>
    ICONS.filter(x => x.title === (scheme === 'dark' ? 'dark' : 'light'))[0].path

  const rows = [
    [72, 71, 70, 69, 68, 67, 66, 65, 64],
    [55, 56, 57, 58, 59, 60, 61, 62, 63],
    [54, 53, 52, 51, 50, 49, 48, 47, 46],
    [37, 38, 39, 40, 41, 42, 43, 44, 45],
    [36, 35, 34, 33, 32, 31, 30, 29, 28],
    [19, 20, 21, 22, 23, 24, 25, 26, 27],
    [18, 17, 16, 15, 14, 13, 12, 11, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  ]

  const check = (z: number) => (getPlan(z)[0] ? getPlan(z)[0].plan : false)

  return (
    <ImageBackground source={source()} style={img}>
      <View style={container}>
        {rows.map((a, i) => (
          <View style={row} key={i}>
            {a.map(b => (
              <View key={b} style={[box]}>
                {b === check(b) ? (
                  <Gem plan={b} player={DiceStore.players} />
                ) : (
                  <Text h={'h11'} title={b !== 68 ? b.toString() : ' '} />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ImageBackground>
  )
})

export { GameBoard }
