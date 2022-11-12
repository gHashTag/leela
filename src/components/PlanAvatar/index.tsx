import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import {
  ImageBackground,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
} from 'react-native'
import { ms, s } from 'react-native-size-matters'
import Ionicons from 'react-native-vector-icons/Ionicons'

import { Text } from '..'
import { orange, primary } from '../../constants'

interface PlanAvatarI {
  plan: number
  size: 'xLarge' | 'large' | 'medium' | 'small'
  avaUrl?: string
  isAccept?: boolean
  aditionalStyle?: StyleProp<ImageStyle>
  onPress?: () => void
}

export const PlanAvatar = memo(function ({
  size = 'medium',
  plan,
  avaUrl,
  aditionalStyle,
  isAccept,
  onPress,
}: PlanAvatarI) {
  const {
    colors: { background },
  } = useTheme()
  const textPlan = plan < 10 ? `0${plan}` : `${plan}`
  const fontSize = size === 'small' ? s(6) : s(10)
  const badgeS = size === 'small' || size === 'medium' ? smallBadge : bigBadge
  return (
    <ImageBackground
      source={{ uri: avaUrl }}
      style={[styles[size], aditionalStyle]}
      imageStyle={container}
    >
      <Pressable
        onPress={onPress}
        style={[badge, badgeS, { backgroundColor: background }]}
      >
        {!isAccept ? (
          <Ionicons size={s(15)} color={orange} name="time-sharp" />
        ) : (
          <Text textStyle={{ fontSize }} title={textPlan} h="h12" />
        )}
      </Pressable>
    </ImageBackground>
  )
})

const styles = StyleSheet.create({
  xLarge: {
    marginLeft: 1,
    width: ms(130),
    height: ms(130),
  },
  large: {
    marginLeft: 1,
    width: s(55),
    height: s(55),
  },
  medium: {
    width: s(50),
    height: s(50),
  },
  small: {
    width: s(36),
    height: s(36),
  },
  container: {
    borderRadius: ms(130),
    borderColor: primary,
    borderWidth: s(0.9),
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(130),
    flexDirection: 'row',
    position: 'absolute',
    borderColor: primary,
    borderWidth: s(0.8),
    padding: s(2),
  },
  smallBadge: {
    right: s(-1),
    bottom: s(1),
  },
  bigBadge: {
    right: s(-1),
    bottom: s(2),
  },
})

const { container, badge, bigBadge, smallBadge } = styles
