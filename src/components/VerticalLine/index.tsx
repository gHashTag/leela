import React from 'react'
import { StyleProp, ViewStyle, View, StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  container: {
    height: 80,
    width: 1,
    backgroundColor: '#EEEEEE'
  }
})

interface VerticalLineT {
  viewStyle?: StyleProp<ViewStyle>
}

const VerticalLine = ({ viewStyle }: VerticalLineT) => {
  const { container } = styles
  return <View style={[container, viewStyle]} />
}

export { VerticalLine }
