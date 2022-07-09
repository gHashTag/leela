import { useTheme } from '@react-navigation/native'
import React, { memo, useState } from 'react'
import { TouchableOpacity, Image, StyleSheet, View } from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'

import { ICONS } from './images'
import { s, ms } from 'react-native-size-matters'

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
    alignSelf: 'center'
  },
  buttonStyle: {
    top: 2,
    width: ms(70, 0.5),
    height: ms(70, 0.5)
  }
})

const ButtonPlay = memo<ButtonPlayT>(({ isStop = false, onPress }) => {
  const source = () => ICONS[isStop ? 'pause' : 'play']
  const { container, buttonStyle } = styles

  const {
    colors: { background }
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
