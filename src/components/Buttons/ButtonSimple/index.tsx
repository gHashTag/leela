import React, { memo } from 'react'

import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { vs } from 'react-native-size-matters'

import { Text } from '../../'
import { Pressable } from '../../Pressable'

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center'
  },
  fontStyle: {
    marginTop: vs(5),
    marginBottom: vs(5)
  }
})

interface ButtonSimpleT {
  title: string
  h?:
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
  onPress?: () => void
  width?: number
  viewStyle?: StyleProp<ViewStyle>
  testID?: string
  accessibilityLabel?: string
  accessibilityHint?: string
}

const ButtonSimple = memo<ButtonSimpleT>(
  ({
    title,
    onPress,
    h = 'h4',
    viewStyle,
    testID,
    accessibilityLabel,
    accessibilityHint
  }) => {
    const { container, fontStyle } = styles
    return (
      <Pressable
        onPress={onPress}
        style={[container, viewStyle]}
        testID={testID}
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
      >
        {/*
          Two lines at accessibility sizes keeps link-style buttons readable.
          The fixed container still centers the text; wrapping is preferable to
          truncation for low-vision users.
        */}
        <Text numberOfLines={2} h={h} title={title} textStyle={fontStyle} />
      </Pressable>
    )
  }
)

export { ButtonSimple }
