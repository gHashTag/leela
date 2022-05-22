import React from 'react'
import { View, TouchableOpacity, useColorScheme } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'
import { Tab } from './components'
import { black, white } from './constants'
import { DiceStore } from './store'
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { observer } from 'mobx-react-lite'

export default observer(function TabBar({
  state,
  descriptors,
  navigation
}: MaterialTopTabBarProps) {
  const { index, routes } = state
  const scheme = useColorScheme()
  const { bottom } = useSafeAreaInsets()

  const curRoute = routes.filter(a =>
    DiceStore.online ? true : a.name === 'TAB_BOTTOM_3' ? false : true
  )
  const tabContainer = [
    container,
    {
      backgroundColor: scheme === 'dark' ? black : white,
      paddingBottom: bottom + s(5)
    }
  ]

  return (
    <View style={tabContainer}>
      {curRoute.map(({ name, key }, id) => {
        const isFocused = `TAB_BOTTOM_${index}` === name
        return (
          <TouchableOpacity
            key={key}
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
              imageStyle={{ alignSelf: 'flex-start' }}
            />
          </TouchableOpacity>
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
    paddingTop: s(10),
    flexDirection: 'row'
  }
})

const { container } = styles
