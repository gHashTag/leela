import React, { useEffect, useState } from 'react'

import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { SecondaryTabT } from '../SecondaryTab'

export const OwnTabView = ({ screens, style, width, renderTabBar }: OwnTabViewT) => {
  const [navigationState, setNavState] = useState<navStateT>({
    index: 0,
    routes: screens.map(obj => ({ key: obj.key, title: obj.title })),
  })

  const jumpTo = (key: string, id: number) => {
    if (id !== navigationState.index) {
      setNavState(pr => ({ ...pr, index: id }))
    }
  }

  const x = useSharedValue(0)

  useEffect(() => {
    x.value = withTiming(width * navigationState.index, { duration: 300 })
  }, [navigationState.index])

  const carousel = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: -x.value }],
    }
  })

  return (
    <View style={[mainContainer, style, { width }]}>
      {renderTabBar({ jumpTo, navigationState, width })}
      <Animated.View style={[contentContainer, carousel]}>
        {screens.map(({ Scene, key }) => {
          return (
            <View key={key} style={{ width }}>
              <Scene />
            </View>
          )
        })}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  mainContainer: {
    overflow: 'hidden',
  },
})

const { contentContainer, mainContainer } = styles

interface OwnTabViewT {
  screens: scenes[]
  style?: StyleProp<ViewStyle>
  width: number
  renderTabBar: (props: SecondaryTabT) => JSX.Element
}

interface navStateT {
  index: number
  routes: { key: string; title: string }[]
}

interface scenes {
  key: string
  title: string
  Scene: () => JSX.Element
}
