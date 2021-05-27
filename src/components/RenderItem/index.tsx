import React, { memo } from 'react'
import { TouchableOpacity } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'
import { W } from '../../constants'
import { Txt } from '../Txt'

const styles = ScaledSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: W - 30,
    right: s(15)
  },
  titleStyle: {
    fontSize: 28,
    textAlign: 'left',
    left: s(15)
  }
})

interface RenderItemT {
  title: string
  onPress?: () => void
}

const RenderItem = memo<RenderItemT>(({ title, onPress }) => {
  const { container, titleStyle } = styles

  return (
    <TouchableOpacity onPress={onPress} style={container}>
      <Txt h2 title={title} textStyle={titleStyle} numberOfLines={1} />
    </TouchableOpacity>
  )
})

export { RenderItem }
