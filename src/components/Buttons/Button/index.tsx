import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { StyleProp, TextStyle } from 'react-native'
import { ScaledSheet, ms, s } from 'react-native-size-matters'

import { Text } from '../../'
import { W, black, white } from '../../../constants'
import { Pressable } from '../../Pressable'

const styles = ScaledSheet.create({
  container: {
    alignSelf: 'center',
    width: W - ms(70, 1.8),
    height: ms(70),
    borderRadius: s(40),
    borderWidth: 1,
    justifyContent: 'center',
  },
  h: {
    textAlign: 'center',
    paddingHorizontal: 15,
  },
})

interface ButtonT {
  title: string
  cancel?: boolean
  onPress?: () => void
  textStyle?: StyleProp<TextStyle>
}

const Button = memo<ButtonT>(({ title, onPress, textStyle }) => {
  const { container, h } = styles
  const { dark } = useTheme()
  const borderColor = dark ? white : black
  const backgroundColor = dark ? black : white
  return (
    <Pressable style={[container, { backgroundColor, borderColor }]} onPress={onPress}>
      <Text h="h1" textStyle={[h, textStyle]} title={title} />
    </Pressable>
  )
})

export { Button }
