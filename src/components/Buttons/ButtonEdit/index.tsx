import React from 'react'
import { StyleProp, ViewStyle, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { vs } from 'react-native-size-matters'

const styles = StyleSheet.create({
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
  const { img } = styles
  return (
    <TouchableOpacity onPress={onPress} style={viewStyle}>
      <Image style={img} source={require('./edit.png')} />
    </TouchableOpacity>
  )
}

export { ButtonEdit }
