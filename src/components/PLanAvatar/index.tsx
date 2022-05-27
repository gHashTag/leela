import React from 'react'
import {
  Image,
  ImageBackground,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  View
} from 'react-native'
import { ms, s } from 'react-native-size-matters'
import { classicRose, mustard, primary } from '../../constants'
import { Text } from '..'
import { useTheme } from '@react-navigation/native'

interface PlanAvatarI {
  plan: number
  size: 'xLarge' | 'large' | 'medium' | 'small'
  avaUrl?: string
  aditionalStyle?: StyleProp<ImageStyle>
  onPress?: () => void
}

export function PlanAvatar({
  size = 'medium',
  plan,
  avaUrl,
  aditionalStyle,
  onPress
}: PlanAvatarI) {
  const {
    colors: { background }
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
        <Text textStyle={{ fontSize }} title={textPlan} h="h12" />
      </Pressable>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  xLarge: {
    marginLeft: 1,
    width: ms(130),
    height: ms(130)
  },
  large: {
    marginLeft: 1,
    width: s(55),
    height: s(55)
  },
  medium: {
    width: s(50),
    height: s(50)
  },
  small: {
    width: s(36),
    height: s(36)
  },
  container: {
    borderRadius: ms(130),
    borderColor: primary,
    borderWidth: s(0.9)
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(130),
    flexDirection: 'row',
    position: 'absolute',
    borderColor: primary,
    borderWidth: s(0.8),
    padding: s(2)
  },
  smallBadge: {
    right: s(-1),
    bottom: s(1)
  },
  bigBadge: {
    right: s(-1),
    bottom: s(2)
  }
})

const { container, badge, bigBadge, smallBadge } = styles
