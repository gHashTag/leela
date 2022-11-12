import React, { memo } from 'react'

import { GestureResponderEvent, Platform } from 'react-native'
import { Button, ThemeProvider } from 'react-native-elements'
import { s } from 'react-native-size-matters'

import { secondary, trueBlue, white } from '../../../constants'

const themes = {
  default: {
    Button: {
      titleStyle: {
        color: secondary,
        fontSize: s(16),
        fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Montserrat',
      },
      containerStyle: {
        width: s(240),
        paddingHorizontal: 30,
        alignSelf: 'center',
      },
    },
    colors: {
      primary: secondary,
    },
  },
  classic: {
    Button: {
      titleStyle: {
        color: white,
        fontSize: s(16),
        fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Montserrat',
      },
      containerStyle: {
        width: s(260),
        paddingHorizontal: 30,
        alignSelf: 'center',
      },
    },
    colors: {
      primary: trueBlue,
    },
  },
}

interface ButtonElementsT {
  title: string
  type?: 'solid' | 'clear' | 'outline'
  themeType?: 'classic' | 'default'
  onPress: (event: GestureResponderEvent) => void
}

const ButtonElements = memo<ButtonElementsT>(
  ({ title, type = 'outline', onPress, themeType = 'default' }) => {
    const theme = themes[themeType]
    return (
      <ThemeProvider theme={theme}>
        <Button title={title} type={type} onPress={onPress} />
      </ThemeProvider>
    )
  },
)

export { ButtonElements }
