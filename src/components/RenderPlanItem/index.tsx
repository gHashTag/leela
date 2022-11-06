import React, { memo } from 'react'
import { TouchableOpacity } from 'react-native'
import { ScaledSheet, s, vs } from 'react-native-size-matters'
import { W } from '../../constants'
import { Text } from '../'

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: W - 30,
    right: s(15),
    marginVertical: vs(10)
  },
  titleStyle: {
    left: s(15)
  }
})

interface RenderItemT {
  title: string
  onPress?: () => void
}

const RenderPlanItem = memo<RenderItemT>(({ title, onPress }) => {
  const { container, titleStyle } = styles

  return (
    <TouchableOpacity onPress={onPress} style={container}>
      <Text h="h4" title={title} textStyle={titleStyle} numberOfLines={1} />
    </TouchableOpacity>
  )
})

export { RenderPlanItem }
