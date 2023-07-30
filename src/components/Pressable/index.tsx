import React from 'react'

import {
  PressableStateCallbackType,
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
  StyleProp,
  ViewStyle
} from 'react-native'

type PressableProps = Omit<RNPressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
}

const Pressable: React.FC<PressableProps> = ({
  children,
  style,
  pressedStyle,
  ...props
}) => {
  const defaultPressedStyle: StyleProp<ViewStyle> = { opacity: 0.2 } // default Pressable-like press style

  const handlePressStyle = ({
    pressed
  }: PressableStateCallbackType): StyleProp<ViewStyle> => {
    if (pressed) {
      return [
        style,
        pressedStyle || defaultPressedStyle
      ] as StyleProp<ViewStyle>
    }
    return style as StyleProp<ViewStyle>
  }

  return (
    <RNPressable style={handlePressStyle} {...props}>
      {children}
    </RNPressable>
  )
}
export { Pressable }
