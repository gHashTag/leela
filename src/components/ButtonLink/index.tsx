import React, { memo } from 'react'
import { StyleSheet, StyleProp, ViewStyle, TextStyle, TouchableOpacity } from 'react-native'
import { Txt } from '../Txt'
import { white, secondary } from '../../constants'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  h: {
    textDecorationLine: 'underline',
    color: secondary
  }
})

interface ButtonLinkT {
  title: string
  viewStyle?: StyleProp<ViewStyle>
  onPress?: () => void
  textStyle?: StyleProp<TextStyle>
}

const ButtonLink = memo<ButtonLinkT>(({ title, viewStyle, textStyle, onPress }) => {
  const { container, h } = styles

  return (
    <TouchableOpacity onPress={onPress} style={[container, viewStyle]}>
      <Txt h8 title={title} textStyle={[h, textStyle]} color={secondary} />
    </TouchableOpacity>
  )
})

export { ButtonLink }
