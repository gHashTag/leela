import React, { memo } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  ViewStyle,
  StyleProp
} from 'react-native'
import { Text } from '../../'
import { s } from 'react-native-size-matters'

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center'
  },
  fontStyle: {
    marginTop: 5,
    marginBottom: 5
  }
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
  onPress?: (event: GestureResponderEvent) => void
  width?: number
  viewStyle?: StyleProp<ViewStyle>
}

const ButtonSimple = memo<ButtonSimpleT>(
  ({ title, onPress, h = 'h4', width = s(200), viewStyle }) => {
    const { container, fontStyle } = styles
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[container, viewStyle, { width }]}
      >
        <Text h={h} title={title} textStyle={fontStyle} />
      </TouchableOpacity>
    )
  }
)

export { ButtonSimple }
