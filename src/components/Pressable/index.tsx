import React from 'react'

import {
  PressableStateCallbackType,
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
  StyleProp,
  ViewStyle
} from 'react-native'
import { s } from 'react-native-size-matters'

type PressableProps = Omit<RNPressableProps, 'style' | 'onPress'> & {
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  onPress?: () => void
}

const Pressable: React.FC<PressableProps> = ({
  children,
  style,
  pressedStyle,
  onPress,
  ...props
}) => {
  const defaultPressedStyle: StyleProp<ViewStyle> = { opacity: 0.2 } // default Pressable-like press style

  // WCAG / iOS HIG minimum touch target: 44 × 44 logical points.
  const touchTargetStyle: StyleProp<ViewStyle> = {
    minWidth: s(44),
    minHeight: s(44),
    justifyContent: 'center',
    alignItems: 'center'
  }

  const handlePressStyle = ({
    pressed
  }: PressableStateCallbackType): StyleProp<ViewStyle> => {
    if (pressed) {
      return [
        touchTargetStyle,
        style,
        pressedStyle || defaultPressedStyle
      ].filter(Boolean) as StyleProp<ViewStyle>
    }
    return [touchTargetStyle, style].filter(Boolean) as StyleProp<ViewStyle>
  }

  const handlePress = () => {
    // Tactile confirmation for pressable interactions across the app.
    // Light impact keeps frequent taps subtle.
    // Respects the global haptic enabled flag.
    if (onPress) {
      const { triggerHaptic } = require('../../utils/haptics')
      triggerHaptic('impactLight')
      onPress()
    }
  }

  return (
    <RNPressable style={handlePressStyle} onPress={handlePress} {...props}>
      {children}
    </RNPressable>
  )
}
export { Pressable }
