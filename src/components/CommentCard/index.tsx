import { observer } from 'mobx-react-lite'
import React, { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { gray, lightGray } from '../../constants'
import { PostStore } from '../../store'
import { CommentT } from '../../types'
import { PlanAvatar } from '../PlanAvatar'
import { Text } from '../Text'

interface CommentCardI {
  item: CommentT
  index: number
  endIndex: number
}

const PADDING = vs(13)

export const CommentCard: React.FC<CommentCardI> = ({ item, index, endIndex }) => {
  const [lineHeight, setLineHeight] = useState(0)

  let date: string | Date = new Date(item.createTime)
  const dateNow = Date.now()
  if (item.createTime >= dateNow - 86400000) {
    date = 'today'
  } else if (item.createTime >= dateNow - 86400000 * 2) {
    date = 'yesterday'
  } else if (dateNow - item.createTime < 30 * 86400000) {
    const days = Math.floor((dateNow - item.createTime) / 86400000)
    date = `${days}d`
  } else if (dateNow - item.createTime < 12 * 30 * 86400000) {
    date = `${Math.floor(item.createTime / 31536000000)}years`
  }

  function _onLayout(e: LayoutChangeEvent) {
    setLineHeight(e.nativeEvent.layout.height)
  }
  return (
    <View style={container}>
      <View style={{ marginRight: s(6) }}>
        <PlanAvatar plan={PostStore.getComPlan(item.ownerId)} size="medium" />
        {endIndex !== index && (
          <View style={{ flex: 1, alignItems: 'center' }} onLayout={_onLayout}>
            <View style={[verticalLine, { height: lineHeight + PADDING * 2 - vs(4) }]} />
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'column', flex: 1 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text h={'h6'} title={`${item.firstName}`} />
          <Text colors={{ light: lightGray, dark: gray }} h={'h6'} title={` ·${date}`} />
        </View>
        <Text h="h6" title={`${item.text}`} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: PADDING,
    flexDirection: 'row',
    paddingHorizontal: s(13)
  },
  verticalLine: {
    width: s(2),
    borderRadius: s(3),
    backgroundColor: lightGray,
    position: 'absolute',
    transform: [{ translateY: vs(2) }]
  }
})

const { container, verticalLine } = styles
