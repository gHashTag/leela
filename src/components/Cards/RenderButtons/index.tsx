import React from 'react'
import { useTheme } from '@react-navigation/native'
import { Pressable, StyleSheet } from 'react-native'
import { vs, s } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { Space, Text } from '../../'
import { ButtonsModalT } from '../../../types'

interface RenderButtonsT {
  item: ButtonsModalT
  index: number
  colorOnPress: string
  press?: () => void
}

export function RenderButtons({
  item,
  index,
  colorOnPress,
  press
}: RenderButtonsT) {
  const { onPress, key, title, color, icon } = item
  const {
    colors: { text }
  } = useTheme()
  const curColor = color ? color : text
  function handlePress() {
    press && press()
    onPress && onPress()
  }

  return (
    <Pressable
      style={({ pressed }) => [
        butCont,
        pressed && { backgroundColor: colorOnPress }
      ]}
      onPress={handlePress}
    >
      <Icon name={icon} color={curColor} size={s(24)} />
      <Space width={s(20)} />
      <Text oneColor={curColor} h="h4" title={title} />
    </Pressable>
  )
}

const stylesButtons = StyleSheet.create({
  butCont: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: s(5),
    paddingVertical: vs(10),
    alignItems: 'center',
    borderRadius: s(30)
  }
})

const { butCont } = stylesButtons
