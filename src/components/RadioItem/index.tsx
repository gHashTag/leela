import { useTheme } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { Image, TouchableOpacity, View } from 'react-native'
import { s, ScaledSheet } from 'react-native-size-matters'
import { PlayButtonStore } from '../../store'
import { ICONS } from './images'

const circle = s(130)

const styles = ScaledSheet.create({
  container: {
    width: circle,
    height: circle,
    borderRadius: s(20),
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    margin: 5
  },
  img: {
    height: circle,
    width: circle,
    backgroundColor: 'transparent'
  }
})

interface RadioItemT {
  id: number
  onPress?: () => void
}

const RadioItem = observer(({ id, onPress }: RadioItemT) => {
  const { container, img } = styles
  // @ts-ignore
  const source = () => ICONS[id + 1]

  const {
    colors: { primary }
  } = useTheme()

  const borderColor = PlayButtonStore.id === id ? primary : 'transparent'
  return (
    <View style={[container, { borderColor }]}>
      <TouchableOpacity onPress={onPress}>
        <Image source={source()} style={img} />
      </TouchableOpacity>
    </View>
  )
})

export { RadioItem }
