import { useTheme } from '@react-navigation/native'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { s, vs } from 'react-native-size-matters'
import { NavigationState } from 'react-native-tab-view'
import { Text } from '../TextComponents'

type State = NavigationState<{
  key: string
  title: string
}>
//SceneRendererProps
export interface SecondaryTabT {
  jumpTo: (key: string, id: number) => void
  navigationState: State
  width: number
}

export const SecondaryTab = ({ jumpTo, navigationState, width }: SecondaryTabT) => {
  const { routes, index } = navigationState
  const tabsCount = routes.length
  const tabWidth = width / tabsCount

  const x = useSharedValue(0)

  useEffect(() => {
    x.value = withTiming(tabWidth * index, { duration: 300 })
  }, [index])

  const {
    colors: { primary }
  } = useTheme()

  const lineAnim = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: x.value }]
    }
  })

  return (
    <Animated.View style={[tabContainer, { width }]}>
      {routes.map(({ title, key }, id) => {
        const isFocused = index === id
        return (
          <Pressable key={key} style={tabStyle} onPress={() => jumpTo(key, id)}>
            <Text oneColor={isFocused ? primary : undefined} h="h4" title={title} />
          </Pressable>
        )
      })}
      <Animated.View
        style={[line, { backgroundColor: primary, width: tabWidth }, lineAnim]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  tabContainer: {
    paddingBottom: vs(5),
    flexDirection: 'row'
  },
  line: {
    height: vs(2),
    position: 'absolute',
    bottom: 0,
    left: 0
  },
  tabStyle: {
    flex: 1,
    marginHorizontal: s(2),
    alignItems: 'center'
  }
})

const { tabContainer, line, tabStyle } = styles
