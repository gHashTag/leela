import React, { useState } from 'react'

import { observer } from 'mobx-react'
import { FlatList, LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { useTypedNavigation } from '../../../hooks'

import { getActions } from './ModalActions'

import {
  ButtonVectorIcon,
  HashtagFormat,
  PlanAvatar,
  Space,
  SubCommentCard,
  Text
} from '../../'
import { OpenActionsModal, gray, lightGray } from '../../../constants'
import { getTimeStamp } from '../../../screens/helper'
import { PostStore } from '../../../store'
import { CommentT } from '../../../types/types'

interface CommentCardI {
  item: CommentT
  index: number
  endIndex: number
}

const PADDING = vs(1)

export const CommentCard: React.FC<CommentCardI> = observer(
  ({ item, index, endIndex }) => {
    const [lineHeight, setLineHeight] = useState(0)
    const [hideTranslate, setHideTranslate] = useState(true)
    const [transText, setTransText] = useState('')
    const { navigate } = useTypedNavigation()

    const avaUrl = PostStore.getAvaById(item.ownerId)

    const date = getTimeStamp({ lastTime: item.createTime, type: '-short' })

    const _onLayout = (e: LayoutChangeEvent) => {
      setLineHeight(e.nativeEvent.layout.height)
    }

    const handleTransText = async () => {
      if (hideTranslate && transText === '') {
        const translated = await PostStore.translateText(item.text)
        setTransText(translated)
      }
      setHideTranslate((pr) => !pr)
    }
    const OpenModal = () => {
      const modalButtons = getActions({ item, handleTransText })
      OpenActionsModal(modalButtons)
    }

    const text = hideTranslate ? item.text : transText

    const subCom = PostStore.store.replyComments.filter(
      (a) => a.commentId === item.id
    )
    const showLine = endIndex !== index || subCom.length > 0
    const isSmallLine = subCom.length > 0 && endIndex === index
    const lineH = isSmallLine
      ? lineHeight + PADDING * 2 - vs(16)
      : lineHeight + PADDING * 2 - vs(4)
    const curName = PostStore.getOwnerName(item.ownerId, false)

    const handleProfile = () => {
      if (item?.ownerId) {
        navigate('USER_PROFILE_SCREEN', {
          ownerId: item?.ownerId,
          editable: false
        })
      }
    }

    return (
      <>
        <View style={styles.container}>
          <View style={{ marginRight: s(6) }}>
            <PlanAvatar
              avaUrl={avaUrl}
              onPress={handleProfile}
              isAccept={true}
              plan={PostStore.getComPlan(item.ownerId)}
              size="medium"
            />
            {showLine && (
              <View style={styles.lineCont} onLayout={_onLayout}>
                <View style={[styles.verticalLine, { height: lineH }]} />
              </View>
            )}
          </View>
          <View style={styles.content}>
            <View style={styles.commentHead}>
              <Text numberOfLines={1} h={'h6'} title={curName as string} />
              <Text
                numberOfLines={1}
                colors={{ light: lightGray, dark: gray }}
                h={'h6'}
                title={`  · ${date}`}
              />
              <View style={styles.flexOne} />
              <ButtonVectorIcon
                size={s(15)}
                name="chevron-down"
                onPress={OpenModal}
              />
              <Space width={s(5)} />
            </View>
            <HashtagFormat h="h6" title={text} selectable />
            <Space height={vs(20)} />
            <FlatList
              data={subCom}
              keyExtractor={(a) => a.id}
              renderItem={({ item: commentItem, index: id }) => (
                <SubCommentCard item={commentItem} index={id} />
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
    paddingVertical: PADDING,
    flexDirection: 'row',
    paddingHorizontal: s(13),
    paddingTop: 15
  },
  verticalLine: {
    width: s(2),
    borderRadius: s(3),
    backgroundColor: lightGray,
    transform: [{ translateY: vs(2) }]
  },
  lineCont: {
    flex: 1,
    alignItems: 'center'
  },
  content: {
    top: 10,
    flexDirection: 'column',
    flex: 1
  },
  commentHead: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  flexOne: {
    flex: 1
  }
})
