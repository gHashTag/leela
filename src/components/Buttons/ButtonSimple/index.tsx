import React, { memo } from 'react'

import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'
import { vs } from 'react-native-size-matters'

import { Text } from '../../'

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  fontStyle: {
    marginTop: vs(5),
    marginBottom: vs(5),
  },
})

interface ButtonSimpleT {
  title: string
  h?:
    | 'h0'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'h7'
    | 'h8'
    | 'h9'
    | 'h10'
    | 'h11'
    | 'h12'
  onPress?: () => void
  width?: number
  viewStyle?: StyleProp<ViewStyle>
}

const ButtonSimple = memo<ButtonSimpleT>(({ title, onPress, h = 'h4', viewStyle }) => {
  const { container, fontStyle } = styles
  return (
    <TouchableOpacity onPress={onPress} style={[container, viewStyle]}>
      <Text numberOfLines={1} h={h} title={title} textStyle={fontStyle} />
    </TouchableOpacity>
  )
})

export { ButtonSimple }
