import React from 'react'

import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs'
import { observer } from 'mobx-react'
import { View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ScaledSheet, ms, s } from 'react-native-size-matters'

import { Pressable, Tab } from './components'
import { black, white } from './constants'

const routeLabels: Record<string, string> = {
  TAB_BOTTOM_0: 'tabRoute.game',
  TAB_BOTTOM_1: 'tabRoute.feed',
  TAB_BOTTOM_2: 'tabRoute.profile',
  TAB_BOTTOM_3: 'tabRoute.onlineGame',
  TAB_BOTTOM_4: 'tabRoute.poster',
  TAB_BOTTOM_5: 'tabRoute.chat'
}

export const TabBar = observer(function TabBar({
  state,
  navigation
}: MaterialTopTabBarProps) {
  const { index, routes } = state
  const scheme = useColorScheme()
  const { bottom } = useSafeAreaInsets()
  const { t } = useTranslation()

  const tabContainer = [
    container,
    {
      backgroundColor: scheme === 'dark' ? black : white,
      paddingBottom: bottom + s(10)
    }
  ]

  return (
    <View style={tabContainer} accessibilityRole="tablist">
      {routes.map(({ name, key }, id) => {
        const isFocused = index === id
        const labelKey = routeLabels[name] || name
        const label = t(labelKey)
        const hint = isFocused ? t('tabRoute.activeHint') : t('tabRoute.inactiveHint')
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={label}
            accessibilityHint={hint}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: key,
                canPreventDefault: true
              })

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate('MAIN', {
                  screen: name,
                  merge: true
                })
              }
            }}
          >
            <Tab
              title={isFocused ? name : `${name}_DISABLE`}
              accessibilityLabel={label}
            />
          </Pressable>
        )
      })}
    </View>
  )
})

const styles = ScaledSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: ms(10, 0.5),
    flexDirection: 'row'
  }
})

const { container } = styles

export default TabBar
