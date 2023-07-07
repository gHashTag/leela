import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { Image, StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { ICONS } from './images'

import { Pressable } from '../../Pressable'

interface ButtonPlayT {
  isStop: boolean
  onPress?: () => void
}
const circle = s(60)

const page = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    width: circle,
    height: circle,
    borderRadius: circle / 2,
    shadowColor: 'black',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.5,
    elevation: 5,
    alignSelf: 'center',
  },
  buttonStyle: {
    width: s(60),
    height: s(60),
  },
})

const ButtonPlay = memo<ButtonPlayT>(({ isStop = false, onPress }) => {
  const source = () => ICONS[isStop ? 'pause' : 'play']

  const {
    colors: { background },
  } = useTheme()

  return (
    <Pressable onPress={onPress}>
      <View style={[page.container, { backgroundColor: background }]}>
        <Image source={source()} style={page.buttonStyle} />
      </View>
    </Pressable>
  )
})

export { ButtonPlay }
