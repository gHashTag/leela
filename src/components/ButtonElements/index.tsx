import React, { memo } from 'react'
import { GestureResponderEvent, Platform } from 'react-native'
import { ThemeProvider, Button } from 'react-native-elements'
import { s } from 'react-native-size-matters'
import { secondary } from '../../constants'

const theme = {
  Button: {
    titleStyle: {
      color: secondary,
      fontSize: s(16),
      fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Montserrat'
    },
    containerStyle: {
      width: s(240),
      paddingHorizontal: 30,
      alignSelf: 'center'
    }
  },
  colors: {
    primary: secondary
  }
}

interface ButtonElementsT {
  title: string
  type?: 'solid' | 'clear' | 'outline' | undefined
  onPress: (event: GestureResponderEvent) => void
}

const ButtonElements = memo<ButtonElementsT>(({ title, type = 'outline', onPress }) => {
  return (
    <ThemeProvider theme={theme}>
      <Button title={title} type={type} onPress={onPress} />
    </ThemeProvider>
  )
})

export { ButtonElements }
