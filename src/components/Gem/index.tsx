import React, { useEffect, useRef } from 'react'

import { observer } from 'mobx-react'
import { Image, ImageSourcePropType, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { ScaledSheet, ms } from 'react-native-size-matters'
import { useTypedNavigation } from '../../hooks'
import { getUid } from '../../screens/helper'
import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  OtherPlayers
} from '../../store'
import { useAppTheme } from '../../utils/useAppTheme'

import { ICONS } from './images'

interface GemT {
  plan: number
  player: number
  index: number
}

interface dataI {
  data: number
  id: number
  ava?: string | number
  ownerId?: string
}

const BOX_SIZE = 31
const BOX_MARGIN_H = 1
const BOX_MARGIN_V = 2

const getCoordinatesForPlan = (plan: number) => {
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

  for (let row = 0; row < rows.length; row++) {
    const col = rows[row].indexOf(plan)
    if (col !== -1) {
      return {
        x: col * (BOX_SIZE + BOX_MARGIN_H * 2),
        y: row * (BOX_SIZE + BOX_MARGIN_V * 2)
      }
    }
  }

  return { x: 0, y: 0 }
}

const Gem = observer(({ plan, index }: GemT) => {
  const { navigate } = useTypedNavigation()
  const { container, gems } = styles
  const theme = useAppTheme()
  const highContrast = theme === 'highContrast'

  const online = DiceStore.online

  const DATA: dataI[] = !online
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
        {
          id: 1,
          data: OnlinePlayer.store.plan,
          ava: OnlinePlayer.store.avatar,
          ownerId: getUid()
        },
        ...OtherPlayers.store.online.slice().map((a, i) => {
          return {
            id: i + 2,
            data: a.plan,
            ava: a.avatar,
            ownerId: a.owner
          }
        })
      ]

  const source = (id: number, ava?: string | number): ImageSourcePropType => {
    if (typeof ava === 'number') {
      return ava
    }

    let uri
    if (ava !== undefined && ava !== '') {
      uri = ava
    } else {
      uri =
        'https://bafkreiftrmfmimlvo26xaxfvt2ypnjjaavq5mgnkjljs6mczfekii4cmtq.ipfs.nftstorage.link/'
    }

    return online ? { uri } : ICONS[id - 1]
  }

  return (
    <View style={container}>
      {DATA.map(({ data, id, ava, ownerId }) => {
        const onPressAva = () => {
          ownerId &&
            navigate('USER_PROFILE_SCREEN', { ownerId, editable: false })
        }

        if (data === plan && (!online || (online && ava !== undefined))) {
          return (
            <GestureDetector
              gesture={Gesture.Tap().onTouchesUp(() => runOnJS(onPressAva)())}
              key={id}
            >
              <AnimatedGem
                plan={data}
                index={index}
                id={id}
                online={online}
                source={source(id, ava)}
                onPressAva={onPressAva}
                highContrast={highContrast}
              />
            </GestureDetector>
          )
        } else {
          // `null`, not `<></>`. An empty fragment is still a child of the
          // list, and it carried no `key` — which is the whole of *"Each child
          // in a list should have a unique key prop"* on the game screen, from
          // an `observer` component, seventy-two boards' worth of squares at a
          // time. React drops a `null` child outright, so there is nothing left
          // to key.
          return null
        }
      })}
    </View>
  )
})

interface AnimatedGemT {
  plan: number
  index: number
  id: number
  online: boolean
  source: ImageSourcePropType
  onPressAva: () => void
  highContrast: boolean
}

const AnimatedGem = observer(
  ({ plan, index, id, online, source, highContrast }: AnimatedGemT) => {
    const prevPlanRef = useRef(plan)
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)

    useEffect(() => {
      const previousPlan = prevPlanRef.current
      if (previousPlan !== plan) {
        const from = getCoordinatesForPlan(previousPlan)
        const to = getCoordinatesForPlan(plan)

        translateX.value = from.x - to.x
        translateY.value = from.y - to.y

        const duration = highContrast ? 0 : 350
        translateX.value = withTiming(0, { duration })
        translateY.value = withTiming(0, { duration })

        prevPlanRef.current = plan
      }
    }, [plan, highContrast])

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value }
      ]
    }))

    return (
      <Animated.Image
        style={[
          styles.gems,
          {
            zIndex: -index,
            borderWidth: highContrast ? 2 : 0,
            borderColor: highContrast
              ? id === 1
                ? '#FFFFFF'
                : '#000000'
              : 'transparent'
          },
          id === 1 && online && styles.primaryGem,
          animatedStyle
        ]}
        source={source}
      />
    )
  }
)

const styles = ScaledSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  gems: {
    position: 'absolute',
    width: ms(42, 0.5),
    height: ms(42, 0.5),
    borderRadius: ms(42, 0.5) / 2
  },
  primaryGem: {
    zIndex: 2
  }
})

export { Gem }
