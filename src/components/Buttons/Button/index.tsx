import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { StyleProp, TextStyle } from 'react-native'
import { ScaledSheet, ms, s } from 'react-native-size-matters'

import { Text } from '../../'
import { black, isIos, white } from '../../../constants'
import { Pressable } from '../../Pressable'

const styles = ScaledSheet.create({
  container: {
    alignSelf: 'center',
    // minWidth rather than width: every existing title is narrower than this,
    // so those buttons look unchanged, but a long one ("Start the journey")
    // used to be clipped by the fixed pill instead of widening it.
    minWidth: ms(230, 0.9),
    maxWidth: '90%',
    height: ms(50, 0.9),
    borderRadius: s(40),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  h: {
    textAlign: 'center',
    paddingHorizontal: 15,
    top: isIos ? 3 : -2
  }
})

interface ButtonT {
  title: string
  cancel?: boolean
  onPress?: () => void
  textStyle?: StyleProp<TextStyle>
  testID?: string
  accessibilityLabel?: string
  accessibilityHint?: string
}

const Button = memo<ButtonT>(({
  title,
  onPress,
  textStyle,
  testID,
  accessibilityLabel,
  accessibilityHint
}) => {
  const { container, h } = styles
  const { dark } = useTheme()
  const borderColor = dark ? white : black
  const backgroundColor = dark ? black : white
  return (
    <Pressable
      style={[container, { backgroundColor, borderColor }]}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
    >
      {/*
        At default sizes one line shrinking-to-fit keeps the pill shape. At
        accessibility sizes we allow a second line so the button remains usable
        without clipping.
      */}
      <Text
        h="h1"
        textStyle={[h, textStyle]}
        title={title}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      />
    </Pressable>
  )
})

export { Button }
