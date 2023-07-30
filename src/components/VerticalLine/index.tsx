import React from 'react'

import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { white } from '../../constants'

const styles = StyleSheet.create({
  container: {
    height: 80,
    width: 1,
    backgroundColor: white
  }
})

interface VerticalLineT {
  viewStyle?: StyleProp<ViewStyle>
}

const VerticalLine = ({ viewStyle }: VerticalLineT) => {
  return <View style={[styles.container, viewStyle]} />
}

export { VerticalLine }
