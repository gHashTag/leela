import React, { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View, FlatList } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { gray, lightGray, navigate, OpenReplyModal } from '../../../constants'
import { OnlinePlayer, OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT, CommentT } from '../../../types'
import {
  ButtonVectorIcon,
  SubCommentCard,
  Text,
  Space,
  PlanAvatar,
  HashtagFormat
} from '../../'
import { nanoid } from 'nanoid/non-secure'
import Clipboard from '@react-native-clipboard/clipboard'
import { getTimeStamp, getUid } from '../../../screens/helper'
import { observer } from 'mobx-react-lite'
import I18n from 'i18n-js'
import { getActions } from './ModalActions'

interface CommentCardI {
  item: CommentT
  index: number
  endIndex: number
}

const PADDING = vs(13)

export const CommentCard: React.FC<CommentCardI> = observer(
  ({ item, index, endIndex }) => {
    const [lineHeight, setLineHeight] = useState(0)
    const [hideTranslate, setHideTranslate] = useState(true)
    const [transText, setTransText] = useState('')

    const avaUrl = PostStore.getAvaById(item.ownerId)

    const date = getTimeStamp({ lastTime: item.createTime, type: 1 })

    const _onLayout = (e: LayoutChangeEvent) => {
      setLineHeight(e.nativeEvent.layout.height)
    }

    const handleTransText = async () => {
      if (hideTranslate && transText === '') {
        const translated = await PostStore.translateText(item.text)
        setTransText(translated)
      }
      setHideTranslate(pr => !pr)
    }
    const OpenModal = () => {
      const modalButtons = getActions({ hideTranslate, item, handleTransText })
      OpenReplyModal(modalButtons)
    }
    const text = hideTranslate ? item.text : transText

    const subCom = PostStore.store.replyComments.filter(a => a.commentId === item.id)
    const showLine = endIndex !== index || subCom.length > 0
    const isSmallLine = subCom.length > 0 && endIndex === index
    const lineH = isSmallLine
      ? lineHeight + PADDING * 2 - vs(16)
      : lineHeight + PADDING * 2 - vs(4)
    const curName = PostStore.getOwnerName(item.ownerId, false)

    return (
      <>
        <View style={container}>
          <View style={{ marginRight: s(6) }}>
            <PlanAvatar
              avaUrl={avaUrl}
              plan={PostStore.getComPlan(item.ownerId)}
              size="medium"
            />
            {showLine && (
              <View style={lineCont} onLayout={_onLayout}>
                <View style={[verticalLine, { height: lineH }]} />
              </View>
            )}
          </View>
          <View style={content}>
            <View style={commentHead}>
              <Text numberOfLines={1} h={'h6'} title={curName} />
              <Text
                numberOfLines={1}
                colors={{ light: lightGray, dark: gray }}
                h={'h6'}
                title={`  · ${date}`}
              />
              <View style={{ flex: 1 }} />
              <ButtonVectorIcon size={s(15)} name="chevron-down" onPress={OpenModal} />
              <Space width={s(5)} />
            </View>
            <HashtagFormat h="h6" title={text} />
            <Space height={vs(20)} />
            <FlatList
              data={subCom}
              keyExtractor={() => nanoid(15)}
              renderItem={({ item, index }) => (
                <SubCommentCard item={item} index={index} />
              )}
            />
          </View>
        </View>
      </>
    )
  }
)

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
  },
  lineCont: {
    flex: 1,
    alignItems: 'center'
  },
  content: {
    flexDirection: 'column',
    flex: 1
  },
  commentHead: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  }
})

const { container, verticalLine, lineCont, content, commentHead } = styles
