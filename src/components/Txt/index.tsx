import React, { memo } from 'react'
import { Platform, StyleProp, TextStyle, Text, StyleSheet } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { s, ms } from 'react-native-size-matters'
import { secondary, white } from '../../constants'

const styles = StyleSheet.create({
  h0Style: {
    fontFamily: Platform.OS === 'ios' ? 'Etna' : 'etna-free-font',
    textAlign: 'center',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? s(35) : s(35)
  },
  h1Style: {
    fontFamily: 'Montserrat',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? s(18) : s(18)
  },
  h2Style: {
    fontFamily: 'Montserrat',
    textAlign: 'center',
    textShadowRadius: 1,
    fontSize: Platform.OS === 'ios' ? ms(15, 0.8) : s(15)
  },
  h3Style: {
    fontSize: Platform.OS === 'ios' ? ms(15, 0.6) : ms(15),
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
    fontSize: Platform.OS === 'ios' ? s(95) : s(95)
  },
  h8Style: {
    fontSize: Platform.OS === 'ios' ? s(19) : s(19),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  },
  h9Style: {
    fontSize: Platform.OS === 'ios' ? s(15) : s(15),
    textAlign: 'center',
    fontFamily: 'Montserrat'
  }
})

interface TxtT {
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
  color?: string
  textAlign?: string
  title: string
  numberOfLines?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  textStyle?: StyleProp<TextStyle>
}

const Txt = memo<TxtT>(
  ({
    h0,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    h7,
    h8,
    h9,
    color,
    title,
    textStyle,
    numberOfLines,
    ellipsizeMode = 'tail',
    textAlign = 'center'
  }) => {
    const { h0Style, h1Style, h2Style, h3Style, h4Style, h5Style, h6Style, h7Style, h8Style, h9Style } = styles

    const {
      colors: { primary, text }
    } = useTheme()

    return (
      <Text
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        style={[
          textStyle,
          h0 && StyleSheet.flatten([h0Style, { color: text, textShadowColor: color ? color : primary }]),
          h1 && StyleSheet.flatten([h1Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h2 && StyleSheet.flatten([h2Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h3 && StyleSheet.flatten([h3Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h4 && StyleSheet.flatten([h4Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h5 && StyleSheet.flatten([h5Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h6 && StyleSheet.flatten([h6Style, { color: text, textShadowColor: color ? color : primary, textAlign }]),
          h7 && StyleSheet.flatten([h7Style, { color: text, textShadowColor: color ? color : primary }]),
          h8 &&
            StyleSheet.flatten([h8Style, { color: secondary, textShadowColor: color ? color : primary, textAlign }]),
          h9 && StyleSheet.flatten([h9Style, { color: white, textAlign }])
        ]}
      >
        {title}
      </Text>
    )
  }
)

export { Txt }
