import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { Pressable, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { ScaledSheet, s } from 'react-native-size-matters'
import Ionicons from 'react-native-vector-icons/Ionicons'

import { Space, Text, hT } from '../../'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface ButtonWithIconT {
  title: string
  onPress?: () => void
  color?: string
  iconName?: string
  viewStyle?: StyleProp<ViewStyle>
  h?: hT
}

export const ButtonWithIcon = memo<ButtonWithIconT>(
  ({ title, onPress, color, iconName, viewStyle, h = 'h2' }) => {
    const {
      colors: { text },
    } = useTheme()
    const isPressed = useSharedValue(0)

    const onTouchStart = () => {
      isPressed.value = withTiming(1, {
        duration: 200,
      })
    }
    const onTouchEnd = () => {
      isPressed.value = withTiming(0, {
        duration: 200,
      })
    }

    const animatedStyles = useAnimatedStyle(() => {
      const bgColor = interpolateColor(
        isPressed.value,
        [0, 1],
        ['#00000000', `${color || text}32`],
      )
      return {
        backgroundColor: bgColor,
      }
    })

    return (
      <AnimatedPressable
        onPress={onPress}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={[container, { borderColor: color || text }, viewStyle, animatedStyles]}
      >
        {iconName && (
          <>
            <Ionicons name={iconName} color={color || text} size={s(20)} />
            <Space width={s(6)} />
          </>
        )}
        <Text h={h} oneColor={color} title={title} />
      </AnimatedPressable>
    )
  },
)

const styles = ScaledSheet.create({
  container: {
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    flexDirection: 'row',
    borderWidth: s(1),
    borderRadius: s(8),
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
})

const { container } = styles
