import React from 'react'

import { useTheme } from '@react-navigation/native'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { s, vs } from 'react-native-size-matters'
import { NavigationState } from 'react-native-tab-view'

import { Text } from '../TextComponents'
import { iconForTab } from './icons'
import { useFontScale } from '../../utils/fontScale'

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

/**
 * The profile tab bar.
 *
 * It used to divide the width equally between the routes and slide a single
 * underline across by `width / count`. With nine tabs that is about 44pt each -
 * narrower than "Reports" - so every label wrapped into stacked fragments and
 * the indicator drifted off the tab it was meant to mark.
 *
 * Now each tab takes the width it needs, the row scrolls when the sum exceeds
 * the screen, and the indicator belongs to the focused tab rather than being
 * positioned by arithmetic that assumed equal widths.
 */
export const SecondaryTab = ({
  jumpTo,
  navigationState,
  width
}: SecondaryTabT) => {
  const { routes, index } = navigationState
  const fontScale = useFontScale()
  const isAccessibilityScale = fontScale >= 1.35

  const {
    colors: { primary, text }
  } = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, { width }]}
      contentContainerStyle={styles.row}
    >
      {routes.map(({ title, key }, id) => {
        const isFocused = index === id
        const color = isFocused ? primary : text

        return (
          <Pressable
            key={key}
            style={styles.tabStyle}
            onPress={() => jumpTo(key, id)}
            accessible
            accessibilityRole="tab"
            accessibilityLabel={title}
            accessibilityState={{ selected: isFocused }}
          >
            <Ionicons name={iconForTab(key)} size={s(18)} color={color} />
            <View style={[styles.labelSlot, isAccessibilityScale && styles.labelSlotLarge]}>
              {/*
                At default sizes one line keeps the bar compact. At accessibility
                sizes labels may wrap so the tab stays readable and tappable.
              */}
              <Text
                oneColor={color}
                h="h6"
                title={title}
                textStyle={isAccessibilityScale ? styles.labelTextLarge : undefined}
                numberOfLines={isAccessibilityScale ? 2 : 1}
              />
            </View>
            <View
              style={[
                styles.line,
                isFocused && { backgroundColor: primary }
              ]}
            />
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0
  },
  row: {
    flexDirection: 'row',
    paddingTop: vs(10),
    paddingHorizontal: s(8)
  },
  tabStyle: {
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingBottom: vs(6)
  },
  labelSlot: {
    marginTop: vs(4),
    minHeight: s(20)
  },
  labelSlotLarge: {
    minHeight: s(36),
    justifyContent: 'center'
  },
  labelTextLarge: {
    textAlign: 'center'
  },
  line: {
    height: vs(2),
    alignSelf: 'stretch',
    marginTop: vs(6),
    borderRadius: vs(1),
    backgroundColor: 'transparent'
  }
})
