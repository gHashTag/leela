import React, { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { gray, lightGray, navigate, OpenReplyModal } from '../../../constants'
import { PostStore } from '../../../store'
import { ButtonsModalT, CommentT } from '../../../types'
import {
  ButtonVectorIcon,
  SubCommentCard,
  Text,
  Space,
  PlanAvatar,
  HashtagFormat
} from '../../'
import { FlatList } from 'react-native-gesture-handler'
import { nanoid } from 'nanoid/non-secure'
import Clipboard from '@react-native-clipboard/clipboard'
import { getTimeStamp, getUid } from '../../../screens/helper'
import { observer } from 'mobx-react-lite'
import I18n from 'i18n-js'

interface CommentCardI {
  item: CommentT
  index: number
  endIndex: number
}

const PADDING = vs(13)

export const CommentCard: React.FC<CommentCardI> = observer(
  ({ item, index, endIndex }) => {
    const [lineHeight, setLineHeight] = useState(0)
    const [lineWidth, setLineWidth] = useState(0)
    const [isTrans, setIsTrans] = useState(false)

    const date = getTimeStamp({ lastTime: item.createTime, type: 1 })

    function _onLayout(e: LayoutChangeEvent) {
      setLineHeight(e.nativeEvent.layout.height)
      setLineWidth(e.nativeEvent.layout.width / 2 + s(6))
    }

    function delCom() {
      PostStore.delComment({ commentId: item.id, isReply: item.reply })
    }

    function reply() {
      navigate('INPUT_TEXT_MODAL', {
        onSubmit: (text: string) =>
          PostStore.replyComment({
            text,
            commentId: item.id,
            commentOwner: item.ownerId
          })
      })
    }

    function transText() {
      setIsTrans(pr => !pr)
    }

    function copy() {
      Clipboard.setString(item.text)
    }

    function OpenModal() {
      const isOwner = getUid() === item.ownerId
      const modalButtons: ButtonsModalT[] = [
        {
          key: 'REPLY',
          onPress: reply,
          title: I18n.t('reply'),
          icon: 'reply-outline'
        },
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
    const subCom = PostStore.store.replyComments.filter(
      a => a.commentId === item.id
    )
    const showLine = endIndex !== index || subCom.length > 0
    const isSmallLine = subCom.length > 0 && endIndex === index
    const lineH = isSmallLine
      ? lineHeight + PADDING * 2 - vs(16)
      : lineHeight + PADDING * 2 - vs(4)

    return (
      <>
        <View style={container}>
          <View style={{ marginRight: s(6) }}>
            <PlanAvatar
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
              <Text numberOfLines={1} h={'h6'} title={`${item.firstName}`} />
              <Text
                numberOfLines={1}
                colors={{ light: lightGray, dark: gray }}
                h={'h6'}
                title={`  · ${date}`}
              />
              <View style={{ flex: 1 }} />
              <ButtonVectorIcon
                size={s(15)}
                name="chevron-down"
                onPress={OpenModal}
              />
              <Space width={s(5)} />
            </View>
            <HashtagFormat h="h6" title={`${item.text}`} />
            <Space height={vs(20)} />
            {subCom.map((a, id) => {
              const key = nanoid(15)
              return (
                <SubCommentCard
                  key={key}
                  item={a}
                  index={id}
                  lineW={lineWidth}
                />
              )
            })}
            {/* Линии обрезаются даже используя overflow свойство */}
            {/* <FlatList
            data={PostStore.store.replyComments.filter(
              a => a.commentId === item.id
            )}
            style={{
              overflow: 'visible',
              flexWrap: 'nowrap',
              backfaceVisibility: 'visible'
            }}
            contentContainerStyle={{
              overflow: 'visible',
              backfaceVisibility: 'visible',
              flexWrap: 'nowrap'
            }}
            keyExtractor={() => nanoid(15)}
            renderItem={props => (
              <SubCommentCard {...props} lineW={lineWidth} />
            )}
          /> */}
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
