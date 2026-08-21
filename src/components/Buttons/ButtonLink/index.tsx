import React, { memo } from 'react'

import {
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
  useColorScheme
} from 'react-native'

import { Text } from '../../'
import { paletteFor } from '../../../theme'
import { Pressable } from '../../Pressable'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  h: {
    textDecorationLine: 'underline'
  }
})

interface ButtonLinkT {
  title: string
  viewStyle?: StyleProp<ViewStyle>
  onPress?: () => void
  textStyle?: StyleProp<TextStyle>
  testID?: string
}

const ButtonLink = memo<ButtonLinkT>(
  ({ title, viewStyle, textStyle, onPress, testID }) => {
    const { container, h } = styles

    /*
     * Every link in the app is this component, and it was `secondary`
     * (#ff06f4) — a magenta with no counterpart in the other scheme, beside a
     * board whose accent is green. One colour here is every link at once.
     */
    const palette = paletteFor(useColorScheme() === 'dark')

    return (
      <Pressable
        onPress={onPress}
        style={[container, viewStyle]}
        testID={testID}
      >
        <Text
          h={'h5'}
          title={title}
          textStyle={[h, { color: palette.accent }, textStyle]}
        />
      </Pressable>
    )
  }
)

export { ButtonLink }
