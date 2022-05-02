import React, { useMemo, useState } from 'react'
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { ms, s, vs } from 'react-native-size-matters'
import { primary } from '../../constants'
import { Space } from '../Space'
import { Text } from '../Text'

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
  const [big, setBig] = useState<0 | 1>(0)
  const [direction, setDirection] = useState<'up' | 'down'>('up')

  useMemo(() => {
    const planStr = plan.toString()
    if (Number(planStr[0]) > Number(planStr[1])) {
      setBig(1)
    } else {
      setBig(0)
    }
    if (Number(planStr[big]) <= 5) {
      setDirection('down')
    } else {
      setDirection('up')
    }
  }, [plan])
  const translateY = direction === 'down' ? s(-3) : s(3)

  return (
    <Pressable onPress={onPress} style={[styles[size], container, aditionalStyle]}>
      {big === 1 && <Space width={s(3)} />}
      <Text
        h="h12"
        title={`${plan.toString()[0]}`}
        textStyle={[
          {
            bottom: plan.toString().length <= 1 ? vs(3) : 0,
            fontSize: styles[size].height - s(big ? 20 : 16)
          },
          big === 0 && plan.toString().length > 1 && { transform: [{ translateY }] }
        ]}
      />
      {plan.toString().length > 1 && (
        <Text
          h="h12"
          title={`${plan.toString()[1]}`}
          textStyle={[
            { fontSize: styles[size].height - s(!big ? 20 : 16) },
            big === 1 && { transform: [{ translateY }] }
          ]}
        />
      )}
      {big === 0 && <Space width={s(3)} />}
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
    paddingBottom: vs(5)
  }
})

const { container } = styles
