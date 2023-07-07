import React, { memo } from 'react'

import { ScaledSheet, s, vs } from 'react-native-size-matters'

import { Text } from '../'
import { Pressable } from '../../components/Pressable'
import { W } from '../../constants'

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: W - 30,
    right: s(15),
    marginVertical: vs(10),
  },
  titleStyle: {
    left: s(15),
  },
})

interface RenderItemT {
  title: string
  onPress?: () => void
  key?: number
}

const RenderPlanItem = memo<RenderItemT>(({ title, onPress, key }) => {
  const { container, titleStyle } = styles

  return (
    <Pressable onPress={onPress} style={container} key={key}>
      <Text h="h4" title={title} textStyle={titleStyle} numberOfLines={1} />
    </Pressable>
  )
})

export { RenderPlanItem }
