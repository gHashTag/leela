import React from 'react'

import { StyleProp, ViewStyle, useColorScheme } from 'react-native'
import { s } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/FontAwesome'
import Ionicons from 'react-native-vector-icons/Ionicons'

import { Text } from '../../'
import { dimGray, gray } from '../../../constants'
import { Pressable } from '../../Pressable'
import { Space } from '../../Space'
import { minTouchTarget } from '../../../utils/hitTarget'
interface ButtonVectorIconI {
  name: string
  size?: number
  iconSize?: number
  color?: string
  onPress?: () => void | Promise<void>
  viewStyle?: StyleProp<ViewStyle>
  count?: number
  ionicons?: boolean
  onPressIn?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  testID?: string
}

export function ButtonVectorIcon({
  name,
  onPress,
  size = s(10),
  iconSize,
  color,
  viewStyle,
  count,
  ionicons,
  onPressIn,
  accessibilityLabel,
  accessibilityHint,
  testID
}: ButtonVectorIconI) {
  const scheme = useColorScheme()
  const colorTheme = scheme === 'dark' ? dimGray : gray
  const summaryIconSize = iconSize ? iconSize : size
  const summaryIoniconsSize = iconSize ? iconSize + s(2) : size + s(2)
  const label =
    accessibilityLabel || `${ionicons ? 'Ionicons' : 'FontAwesome'} ${name}`

  return (
    <Pressable
      style={[minTouchTarget, viewStyle]}
      onPress={onPress}
      pressedStyle={{ opacity: 0.7 }}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {ionicons ? (
        <Ionicons
          name={name}
          size={summaryIoniconsSize}
          color={color ? color : colorTheme}
        />
      ) : (
        <Icon
          name={name}
          size={summaryIconSize}
          color={color ? color : colorTheme}
        />
      )}
      {count !== undefined && (
        <>
          <Space width={s(5)} />
          <Text
            title={count.toString()}
            h={'h5'}
            textStyle={{ fontSize: size, color: colorTheme }}
            accessibilityElementsHidden
          />
        </>
      )}
    </Pressable>
  )
}
