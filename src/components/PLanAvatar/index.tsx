import React from 'react'
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { ms, s } from 'react-native-size-matters'
import { primary } from '../../constants'
import { Text } from '..'

interface PlanAvatarI {
  plan: number
  size: 'xLarge' | 'large' | 'medium' | 'small'
  aditionalStyle?: StyleProp<ViewStyle>
  onPress?: () => void
}

export function PlanAvatar({
  size = 'medium',
  plan,
  aditionalStyle,
  onPress
}: PlanAvatarI) {
  const textPlan = plan < 10 ? `0${plan}` : `${plan}`
  const fontSize = styles[size].height - s(22)

  return (
    <Pressable
      onPress={onPress}
      style={[styles[size], container, aditionalStyle]}
    >
      <Text textStyle={{ fontSize }} title={textPlan} h="h12" />
    </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(130),
    borderColor: primary,
    borderWidth: s(1),
    flexDirection: 'row',
    paddingTop: s(2)
  }
})

const { container } = styles
