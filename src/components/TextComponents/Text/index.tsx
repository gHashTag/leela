import React, { memo } from 'react'
import {
  Platform,
  StyleProp,
  TextStyle,
  Text as RNText,
  StyleSheet,
  TextProps,
  useColorScheme
} from 'react-native'
import { useTheme } from '@react-navigation/native'
import { s, ms } from 'react-native-size-matters'

const styles = StyleSheet.create({
  h0: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: ms(95, 0.5)
  },
  h1: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(35, 0.3) : ms(35, 0.6)
  },
  h2: {
    fontSize: Platform.OS === 'ios' ? s(20) : s(20),
    fontFamily: 'Montserrat'
  },
  h3: {
    fontFamily: 'Montserrat',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(18, 0.6) : ms(18, 0.6)
  },
  h4: {
    fontFamily: 'Montserrat',
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(15, 0.8) : s(15)
  },
  h5: {
    fontSize: Platform.OS === 'ios' ? s(15) : s(15),
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Montserrat'
  },
  h6: {
    fontSize: Platform.OS === 'ios' ? s(15) : s(15),
    fontFamily: 'Montserrat'
  },
  h7: {
    fontSize: ms(15, 0.6),
    fontFamily: 'Montserrat',
    letterSpacing: 0.2,
    lineHeight: ms(18.5, 0.6)
  },
  h8: {
    fontSize: Platform.OS === 'ios' ? s(14) : s(14),
    fontFamily: 'Montserrat'
  },
  h9: {
    fontSize: Platform.OS === 'ios' ? s(13) : s(13),
    fontFamily: 'NeutraText-Bold'
  },
  h10: {
    fontSize: Platform.OS === 'ios' ? s(12) : s(12),
    fontFamily: 'Montserrat'
  },
  h11: {
    fontSize: Platform.OS === 'ios' ? s(10) : s(10),
    fontFamily: 'Montserrat'
  },
  h12: {
    fontSize: Platform.OS === 'ios' ? s(10) : s(10),
    fontFamily: 'OxygenMono-Regular'
  }
})

interface Icolors {
  dark: string
  light: string
}

export type hT =
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

export interface TxtT extends TextProps {
  title: string
  h?: hT
  colors?: Icolors
  oneColor?: string
  textStyle?: StyleProp<TextStyle>
}

export const Text = memo<TxtT>(
  ({ h, colors, title, oneColor, textStyle, ...textProps }) => {
    const {
      colors: { primary, text }
    } = useTheme()
    const scheme = useColorScheme()
    const isDark = scheme === 'dark'
    const curColor = oneColor
      ? oneColor
      : colors
      ? isDark
        ? colors.light
        : colors.dark
      : text

    // если добавлен шрифт и у к нему не нужна тень
    const noShadowFonts = ['h7', 'h1', 'h10', 'h12', 'h4']
    const hasShadow = h ? !noShadowFonts.includes(h) : false

    const hStyle = h
      ? [{ ...styles[h], color: curColor }, hasShadow && { textShadowColor: primary }]
      : undefined
    return (
      <RNText style={[hStyle, textStyle]} {...textProps}>
        {title}
      </RNText>
    )
  }
)
