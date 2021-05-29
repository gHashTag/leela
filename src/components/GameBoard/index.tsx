import React from 'react'
import { ImageBackground, useColorScheme, View } from 'react-native'
import { ICONS } from './images'
import { observer } from 'mobx-react-lite'
import { ScaledSheet, s } from 'react-native-size-matters'
import { W } from '../../constants'
import { Gem } from '../Gem'
import { Txt } from '../Txt'
import {
  PlayerOneStore,
  PlayerTwoStore,
  PlayerThreeStore,
  PlayerFourStore,
  PlayerFiveStore,
  PlayerSixStore,
  DiceStore
} from '../../store'

const ratio = W / 714

const styles = ScaledSheet.create({
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
    height: 630 * ratio,
    marginTop: 50
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
  const arr = [
    {
      plan: PlayerOneStore.plan
    },
    {
      plan: PlayerTwoStore.plan
    },
    {
      plan: PlayerThreeStore.plan
    },
    {
      plan: PlayerFourStore.plan
    },
    {
      plan: PlayerFiveStore.plan
    },
    {
      plan: PlayerSixStore.plan
    }
  ].slice(0, DiceStore.multi)

  const getPlan = (x: number) => arr.filter(y => y.plan === x)
  const { img, container, row } = styles
  const scheme = useColorScheme()
  const source = () => ICONS.filter(x => x.title === (scheme === 'dark' ? 'dark' : 'light'))[0].path

  const row1 = [72, 71, 70, 69, 68, 67, 66, 65, 64]
  const row2 = [55, 56, 57, 58, 59, 60, 61, 62, 63]
  const row3 = [54, 53, 52, 51, 50, 49, 48, 47, 46]
  const row4 = [37, 38, 39, 40, 41, 42, 43, 44, 45]
  const row5 = [36, 35, 34, 33, 32, 31, 30, 29, 28]
  const row6 = [19, 20, 21, 22, 23, 24, 25, 26, 27]
  const row7 = [18, 17, 16, 15, 14, 13, 12, 11, 10]
  const row8 = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  const check = (z: number) => (getPlan(z)[0] ? getPlan(z)[0].plan : false)

  return (
    <ImageBackground source={source()} style={img}>
      <View style={container}>
        <View style={row}>
          {row1.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? (
                <Gem plan={x} player={DiceStore.players} />
              ) : (
                <Txt h5 title={x !== 68 ? x.toString() : ' '} />
              )}
            </View>
          ))}
        </View>
        <View style={row}>
          {row2.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row3.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row4.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row5.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row6.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row7.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
        <View style={row}>
          {row8.map(x => (
            <View key={x} style={[styles.box]}>
              {x === check(x) ? <Gem plan={x} player={DiceStore.players} /> : <Txt h5 title={x.toString()} />}
            </View>
          ))}
        </View>
      </View>
    </ImageBackground>
  )
})

export { GameBoard }
