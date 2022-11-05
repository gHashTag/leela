import React, { memo } from 'react'
import { Pressable, StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { s, ScaledSheet } from 'react-native-size-matters'
import Ionicons from 'react-native-vector-icons/Ionicons'

import { Text, Space } from '../../'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface ButtonWithIconT {
  title: string
  onPress?: () => void
  color?: string
  iconName?: string
  viewStyle?: StyleProp<ViewStyle>
}

export const ButtonWithIcon = memo<ButtonWithIconT>(
  ({ title, onPress, color, iconName, viewStyle }) => {
    const {
      dark,
      colors: { text, border }
    } = useTheme()
    const isPressed = useSharedValue(0)

    const onTouchStart = () => {
      isPressed.value = withTiming(1, {
        duration: 200
      })
    }
    const onTouchEnd = () => {
      isPressed.value = withTiming(0, {
        duration: 200
      })
    }

    const animatedStyles = useAnimatedStyle(() => {
      const bgColor = interpolateColor(
        isPressed.value,
        [0, 1],
        ['#00000000', `${color || text}32`]
      )
      return {
        backgroundColor: bgColor
      }
    })

    return (
      <AnimatedPressable
        onPress={onPress}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={[container, { borderColor: color || border }, viewStyle, animatedStyles]}
      >
        {iconName && (
          <>
            <Ionicons name={iconName} color={color || text} size={s(20)} />
            <Space width={s(6)} />
          </>
        )}
        <Text h="h2" oneColor={color} title={title} />
      </AnimatedPressable>
    )
  }
)

const styles = ScaledSheet.create({
  container: {
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    flexDirection: 'row',
    borderWidth: s(1),
    borderRadius: s(8),
    alignItems: 'center',
    alignSelf: 'flex-start'
  }
})

const { container } = styles
