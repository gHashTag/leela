import React from 'react'

import { useTheme } from '@react-navigation/native'
import { StyleProp, TextStyle } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'

import { Icolors, hT } from '../Text'
import { textStyles } from '../Text'

export function SelectableIOS({ h, title, textStyle, oneColor, colors }: SelectableIosT) {
  const {
    dark,
    colors: { primary, text },
  } = useTheme()

  // если добавлен шрифт и у к нему не нужна тень
  const noShadowFonts = ['h7', 'h1', 'h10', 'h12', 'h4']
  const hasShadow = h ? !noShadowFonts.includes(h) : false
  const curColor = oneColor
    ? oneColor
    : colors
    ? dark
      ? colors.light
      : colors.dark
    : text

  const hStyle = h
    ? [{ ...textStyles[h], color: curColor }, hasShadow && { textShadowColor: primary }]
    : undefined
  return (
    <TextInput
      scrollEnabled={false}
      editable={false}
      multiline
      style={[hStyle, textStyle]}
      value={title}
    />
  )
}
interface SelectableIosT {
  h?: hT
  title: string
  oneColor?: string
  colors?: Icolors
  textStyle?: StyleProp<TextStyle>
}
