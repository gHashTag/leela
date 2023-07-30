import React from 'react'

import { useTheme } from '@react-navigation/native'
import { Pressable, StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'

import { Space, Text } from '../../'
import { ButtonsModalT } from '../../../types'

interface RenderButtonsT {
  item: ButtonsModalT
  index: number
  colorOnPress: string
  press?: () => void
}

export function RenderButtons({ item, colorOnPress, press }: RenderButtonsT) {
  const { onPress, title, color, icon } = item
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
        page.butCont,
        pressed && { backgroundColor: colorOnPress }
      ]}
      onPress={handlePress}
    >
      <Icon name={icon} color={curColor} size={s(24)} />
      <Space width={s(15)} />
      <Text
        textStyle={page.titleStyle}
        oneColor={curColor}
        h="h4"
        title={title}
      />
    </Pressable>
  )
}

const page = StyleSheet.create({
  butCont: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: s(5),
    paddingVertical: vs(10),
    alignItems: 'center',
    borderRadius: s(30)
  },
  titleStyle: {
    flexWrap: 'wrap',
    flex: 1
  }
})
