import React from 'react'

import { useTheme } from '@react-navigation/native'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { lightGray, white } from '../../constants'

export function EmptyComments() {
  const { dark } = useTheme()
  const backgroundColor = dark ? white : lightGray
  const dotStyle = [styles.dot, { backgroundColor }]
  return (
    <View style={styles.dotContainer}>
      <View style={dotStyle} />
      <View style={dotStyle} />
      <View style={[dotStyle, { height: s(8), width: s(8) }]} />
      <View style={dotStyle} />
      <View style={dotStyle} />
    </View>
  )
}
const styles = StyleSheet.create({
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
