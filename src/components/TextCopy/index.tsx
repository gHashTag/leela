import React, { memo } from 'react'
import { Platform, StyleProp, TextStyle, StyleSheet, Text, TextProps } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { s, ms } from 'react-native-size-matters'
import { secondary, white } from '../../constants'

const styles = StyleSheet.create({
  h0Style: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textAlign: 'center',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(35, 0.3) : ms(35, 0.6)
  },
  h1Style: {
    fontFamily: 'Montserrat',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(18, 0.6) : ms(18, 0.6)
  },
  h2Style: {
    fontFamily: 'Montserrat',
    textAlign: 'center',
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(15, 0.8) : s(15)
  },
  h3Style: {
    fontSize: Platform.OS === 'ios' ? ms(15, 0.6) : ms(15, 0.6),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  },
  h4Style: {
    fontSize: Platform.OS === 'ios' ? s(20) : s(20),
    fontFamily: 'Montserrat'
  },
  h5Style: {
    fontSize: Platform.OS === 'ios' ? s(10) : s(10),
    fontFamily: 'Montserrat'
  },
  h6Style: {
    fontSize: Platform.OS === 'ios' ? s(15) : s(15),
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Montserrat'
  },
  h7Style: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textAlign: 'center',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: ms(95, 0.5)
  },
  h8Style: {
    fontSize: Platform.OS === 'ios' ? s(14) : s(14),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  },
  h9Style: {
    fontSize: Platform.OS === 'ios' ? s(15) : s(15),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  },
  h10Style: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textAlign: 'center',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(35, 0.6) : ms(35, 0.6)
  },
  h11Style: {
    fontSize: Platform.OS === 'ios' ? s(12) : s(12),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  }
})

interface TxtT extends TextProps {
  h0?: boolean
  h1?: boolean
  h2?: boolean
  h3?: boolean
  h4?: boolean
  h5?: boolean
  h6?: boolean
  h7?: boolean
  h8?: boolean
  h9?: boolean
  h10?: boolean
  h11?: boolean
  title: string
  textStyle?: StyleProp<TextStyle>
}

const TextCopy: React.FC<TxtT> = memo(
  ({
    h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10,
    h11, title, textStyle, ...textProps
  }) => {
    const {
      h0Style,
      h1Style,
      h2Style,
      h3Style,
      h4Style,
      h5Style,
      h6Style,
      h7Style,
      h8Style,
      h9Style,
      h10Style,
      h11Style
    } = styles

    const {
      colors: { primary, text }
    } = useTheme()

    return <Text
      style={[
        h0 && StyleSheet.flatten([h0Style, { color: text, textShadowColor: primary }]),
        h1 && StyleSheet.flatten([h1Style, { color: text, textShadowColor: primary }]),
        h2 && StyleSheet.flatten([h2Style, { color: text, textShadowColor: primary }]),
        h3 && StyleSheet.flatten([h3Style, { color: text, textShadowColor: primary }]),
        h4 && StyleSheet.flatten([h4Style, { color: text, textShadowColor: primary }]),
        h5 && StyleSheet.flatten([h5Style, { color: text, textShadowColor: primary }]),
        h6 && StyleSheet.flatten([h6Style, { color: text, textShadowColor: primary }]),
        h7 && StyleSheet.flatten([h7Style, { color: text, textShadowColor: primary }]),
        h8 && StyleSheet.flatten([h8Style, { color: secondary, textShadowColor: primary }]),
        h9 && StyleSheet.flatten([h9Style, { color: white }]),
        h10 && StyleSheet.flatten([h10Style, { color: primary }]),
        h11 && StyleSheet.flatten([h11Style, { color: white }]),
        textStyle
      ]}
      {...textProps}
      selectable
    >{title}</Text>
  }
)

export { TextCopy }
