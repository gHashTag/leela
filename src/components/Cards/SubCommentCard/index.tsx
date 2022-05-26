import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ButtonsModalT, ReplyComT } from '../../../types'
import { Text, HashtagFormat, Space } from '../../'
import { PostStore } from '../../../store'
import { PlanAvatar } from '../../'
import { s, vs } from 'react-native-size-matters'
import { fuchsia, lightGray, OpenReplyModal } from '../../../constants'
import { nanoid } from 'nanoid/non-secure'
import { getTimeStamp, getUid } from '../../../screens/helper'
import { ButtonVectorIcon } from '../../Buttons'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'i18n-js'

interface SubComT {
  item: ReplyComT
  index: number
}

export function SubCommentCard({ item, index }: SubComT) {
  const [isTrans, setIsTrans] = useState(false)
  const date = getTimeStamp({ lastTime: item.createTime, type: 1 })
  const avaUrl = PostStore.getAvaById(item.ownerId)

  function OpenModal() {
    function copy() {
      Clipboard.setString(item.text)
    }
    function delCom() {
      PostStore.delComment({ commentId: item.id, isReply: item.reply })
    }
    function transText() {
      setIsTrans(pr => !pr)
    }
    const isOwner = getUid() === item.ownerId
    const modalButtons: ButtonsModalT[] = [
      {
        key: 'COPY',
        onPress: copy,
        title: I18n.t('copy'),
        icon: 'content-copy'
      },
      {
        key: 'TRANSLATE',
        onPress: transText,
        title: I18n.t('translate'),
        icon: isTrans ? 'translate-off' : 'translate'
      },
      {
        key: 'DEL',
        onPress: delCom,
        title: I18n.t('delete'),
        color: 'red',
        icon: 'delete-outline'
      }
    ].filter(a => (isOwner ? true : a.key !== 'DEL'))
    OpenReplyModal(modalButtons)
  }

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
            <Text numberOfLines={1} h={'h6'} title={`${item.firstName}`} />
            <Text numberOfLines={1} h={'h6'} title={` ${date}`} oneColor={lightGray} />
          </View>
        </View>
        <ButtonVectorIcon size={s(10)} name="chevron-down" onPress={OpenModal} />
        <Space width={s(8)} />
      </View>
      <Space height={vs(3)} />
      <View style={textContainer}>
        <Space width={s(5)} />
        <HashtagFormat hashTagColor={fuchsia} title={item.text} h="h6" />
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
