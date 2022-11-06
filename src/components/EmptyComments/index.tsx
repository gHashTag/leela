import { useTheme } from '@react-navigation/native'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { lightGray, white } from '../../constants'

export function EmptyComments() {
  const { dark } = useTheme()
  const backgroundColor = dark ? white : lightGray
  const dotStyle = [dot, { backgroundColor }]
  return (
    <View style={dotContainer}>
      <View style={dotStyle} />
      <View style={dotStyle} />
      <View style={[dotStyle, { height: s(8), width: s(8) }]} />
      <View style={dotStyle} />
      <View style={dotStyle} />
    </View>
  )
}
const style = StyleSheet.create({
  dot: {
    height: s(6),
    width: s(6),
    borderRadius: s(22),
    margin: s(8)
  },
  dotContainer: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(10),
    marginBottom: vs(10)
  }
})

const { dot, dotContainer } = style
