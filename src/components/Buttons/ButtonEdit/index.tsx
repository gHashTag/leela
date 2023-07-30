import React from 'react'

import { Image, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { vs } from 'react-native-size-matters'

import { Pressable } from '../../Pressable'

const page = StyleSheet.create({
  img: {
    width: vs(18),
    height: vs(18)
  }
})

interface ButtonEditT {
  onPress: () => void
  viewStyle?: StyleProp<ViewStyle>
}

const ButtonEdit = ({ onPress, viewStyle }: ButtonEditT) => {
  return (
    <Pressable onPress={onPress} style={viewStyle}>
      <Image style={page.img} source={require('./edit.png')} />
    </Pressable>
  )
}

export { ButtonEdit }
