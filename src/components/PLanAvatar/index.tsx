import React from 'react'
import { Image, ImageStyle, Pressable, StyleProp, StyleSheet, View } from 'react-native'
import { ms, s } from 'react-native-size-matters'
import { classicRose, mustard, primary } from '../../constants'
import { Text } from '..'

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
  const textPlan = plan < 10 ? `0${plan}` : `${plan}`
  const fontSize = size === 'small' ? s(6) : s(10)
  const badgeS = size === 'small' || size === 'medium' ? smallBadge : bigBadge
  return (
    <View style={main}>
      <Image source={{ uri: avaUrl }} style={[styles[size], container, aditionalStyle]} />
      <Pressable onPress={onPress} style={[badge, badgeS]}>
        <Text textStyle={{ fontSize }} title={textPlan} h="h12" />
      </Pressable>
    </View>
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
    borderWidth: s(0.7)
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(130),
    flexDirection: 'row',
    position: 'absolute',
    backgroundColor: classicRose,
    padding: s(1.5)
  },
  smallBadge: {
    right: s(2),
    top: s(2)
  },
  bigBadge: {
    right: s(8),
    top: s(4)
  },
  main: {}
})

const { container, badge, main, bigBadge, smallBadge } = styles
