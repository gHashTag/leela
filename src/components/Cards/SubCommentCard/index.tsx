import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ReplyComT } from '../../../types'
import { Text, HashtagFormat, Space } from '../../'
import { PostStore } from '../../../store'
import { PlanAvatar } from '../../'
import { s, vs } from 'react-native-size-matters'
import { fuchsia, lightGray, OpenReplyModal } from '../../../constants'
import { getTimeStamp } from '../../../screens/helper'
import { ButtonVectorIcon } from '../../Buttons'
import { getActions } from './ModalActions'

interface SubComT {
  item: ReplyComT
  index: number
}

export function SubCommentCard({ item, index }: SubComT) {
  const [hideTranslate, setHideTranslate] = useState(true)
  const [transText, setTransText] = useState('')
  const date = getTimeStamp({ lastTime: item.createTime, type: 1 })
  const avaUrl = PostStore.getAvaById(item.ownerId)
  async function handleTransText() {
    if (hideTranslate && transText === '') {
      const translated = await PostStore.translateText(item.text)
      setTransText(translated)
    }
    setHideTranslate(pr => !pr)
  }
  const OpenModal = () => {
    const modalButtons = getActions({ handleTransText, hideTranslate, item })
    OpenReplyModal(modalButtons)
  }
  const text = hideTranslate ? item.text : transText
  const curName = PostStore.getOwnerName(item.ownerId, false)
  return (
    <View style={container}>
      <View style={commentHead}>
        <PlanAvatar
          avaUrl={avaUrl}
          plan={PostStore.getComPlan(item.ownerId)}
          size="small"
        />
        <Space width={s(6)} />
        <View style={{ flexDirection: 'column', flex: 1 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text numberOfLines={1} h={'h6'} title={curName} />
            <Text numberOfLines={1} h={'h6'} title={` ${date}`} oneColor={lightGray} />
          </View>
        </View>
        <ButtonVectorIcon size={s(10)} name="chevron-down" onPress={OpenModal} />
        <Space width={s(8)} />
      </View>
      <Space height={vs(3)} />
      <View style={textContainer}>
        <Space width={s(5)} />
        <HashtagFormat hashTagColor={fuchsia} title={text} h="h6" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: vs(5)
  },
  branchLine: {
    height: vs(2),
    borderRadius: vs(5),
    backgroundColor: lightGray,
    position: 'absolute',
    alignSelf: 'center'
  },
  commentHead: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  textContainer: {
    flexDirection: 'row'
  }
})

const { container, branchLine, commentHead, textContainer } = styles
