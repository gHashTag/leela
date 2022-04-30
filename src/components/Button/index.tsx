import React, { memo } from 'react'
import { Platform, StyleProp, TextStyle, TouchableOpacity } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { ScaledSheet, scale, ms, s } from 'react-native-size-matters'
import { W, white, black } from '../../constants'
import { Text } from '../Text'

const styles = ScaledSheet.create({
  container: {
    alignSelf: 'center',
    width: W - (Platform.OS === 'ios' ? ms(130, 2.2) : ms(130, 1.8)),
    height: Platform.OS === 'ios' ? ms(60) : ms(70),
    borderRadius: Platform.OS === 'ios' ? scale(30) : scale(35),
    borderWidth: 1,
    paddingTop: Platform.OS === 'ios' ? s(3) : s(0),
    justifyContent: 'center'
  },
  h: {
    textAlign: 'center'
  }
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
    <TouchableOpacity
      style={[container, { backgroundColor, borderColor }]}
      onPress={onPress}
    >
      <Text h="h1" textStyle={[h, textStyle]} title={title} />
    </TouchableOpacity>
  )
})

export { Button }
