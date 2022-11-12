import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { ICONS } from './images'

interface ButtonPlayT {
  isStop: boolean
  onPress?: () => void
}
const circle = s(60)

const styles = StyleSheet.create({
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
  const { container, buttonStyle } = styles

  const {
    colors: { background },
  } = useTheme()

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[container, { backgroundColor: background }]}>
        <Image source={source()} style={buttonStyle} />
      </View>
    </TouchableOpacity>
  )
})

export { ButtonPlay }
