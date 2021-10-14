import React, { memo } from 'react'
import { StyleSheet, TouchableOpacity, GestureResponderEvent, ViewStyle, StyleProp } from 'react-native'
import { Txt } from '../Txt'
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
  h?: 'h0' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8' | 'h9' | 'h10' | 'h11'
  onPress: (event: GestureResponderEvent) => void
  width?: number
  viewStyle?: StyleProp<ViewStyle>
}

const ButtonSimple = memo<ButtonSimpleT>(({ title, onPress, h = 'h0', width = s(200), viewStyle }) => {
  const { container, fontStyle } = styles
  return (
    <TouchableOpacity onPress={onPress} style={[container, viewStyle, { width }]}>
      {h === 'h0' && <Txt h0 title={title} textStyle={fontStyle} />}
      {h === 'h1' && <Txt h1 title={title} textStyle={fontStyle} />}
      {h === 'h2' && <Txt h2 title={title} textStyle={fontStyle} />}
      {h === 'h3' && <Txt h3 title={title} textStyle={fontStyle} />}
      {h === 'h4' && <Txt h4 title={title} textStyle={fontStyle} />}
      {h === 'h5' && <Txt h5 title={title} textStyle={fontStyle} />}
      {h === 'h6' && <Txt h6 title={title} textStyle={fontStyle} />}
      {h === 'h7' && <Txt h7 title={title} textStyle={fontStyle} />}
      {h === 'h8' && <Txt h8 title={title} textStyle={fontStyle} />}
      {h === 'h9' && <Txt h9 title={title} textStyle={fontStyle} />}
      {h === 'h10' && <Txt h10 title={title} textStyle={fontStyle} />}
      {h === 'h11' && <Txt h11 title={title} textStyle={fontStyle} />}
    </TouchableOpacity>
  )
})

export { ButtonSimple }
