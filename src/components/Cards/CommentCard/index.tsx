import React, { useEffect, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { useTypedNavigation } from '../../../hooks'

import { getActions } from './ModalActions'

import {
  AiFeedbackButtons,
  AiSources,
  BookmarkButton,
  ButtonVectorIcon,
  ConfirmDialog,
  FollowUpQuestions,
  PlanAvatar,
  ProBadge,
  Reactions,
  SimplifyAnswer,
  Space,
  SubCommentCard,
  Text
} from '../../'
import { OpenActionsModal, brightTurquoise, gray, lightGray } from '../../../constants'
import { getTimeStamp } from '../../../screens/helper'
import { PostStore } from '../../../store'
import { CommentT } from '../../../types/types'
import { addCachedAiAnswer } from '../../../utils/aiAnswerCache'
import { isAiComment } from '../../../utils/aiComment'
import { useConfirmActions } from '../../ConfirmAction'
import { useFontScale } from '../../../utils/fontScale'

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
    const fontScale = useFontScale()
    const isAccessibilityScale = fontScale >= 1.35
    const { t } = useTranslation()
    const { guardActions, ConfirmDialogComponent } = useConfirmActions(t)

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
      const modalButtons = guardActions(getActions({ item, handleTransText }))
      OpenActionsModal(modalButtons)
    }

    const text = hideTranslate ? item.text : transText

    useEffect(() => {
      const cacheAnswer = async () => {
        if (isAiComment(item.ownerId)) {
          const post =
            PostStore.store.posts.find((a) => a.id === item.postId) ||
            PostStore.store.ownPosts.find((a) => a.id === item.postId)
          await addCachedAiAnswer({
            postId: item.postId,
            text: item.text,
            plan: post?.plan || 0,
            timestamp: item.createTime
          })
        }
      }
      cacheAnswer()
    }, [item.text, item.ownerId, item.postId, item.createTime])

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

    const aiBookmark = isAiComment(item.ownerId)
      ? {
          id: item.id,
          type: 'comment' as const,
          postId: item.postId,
          commentId: item.id,
          text: item.text,
          plan: PostStore.getComPlan(item.ownerId),
          ownerName: 'Leela',
          savedAt: Date.now()
        }
      : null

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
            <View style={[styles.commentHead, isAccessibilityScale && styles.commentHeadLarge]}>
              <Text
                numberOfLines={isAccessibilityScale ? 2 : 1}
                h={'h6'}
                title={curName as string}
              />
              {Boolean(item.pro) && (
                <>
                  <Space width={s(6)} />
                  <ProBadge small />
                </>
              )}
              <Text
                numberOfLines={isAccessibilityScale ? 2 : 1}
                colors={{ light: lightGray, dark: gray }}
                h={'h6'}
                title={`  · ${date}`}
              />
              {item.pending && (
                <Text
                  h="h11"
                  title={t('online-part.sending') || 'sending…'}
                  oneColor={brightTurquoise}
                  textStyle={styles.sending}
                />
              )}
              <View style={styles.flexOne} />
              {!item.pending && (
                <ButtonVectorIcon
                  size={s(15)}
                  name="chevron-down"
                  onPress={OpenModal}
                  accessibilityLabel={t('accessibility.commentMenu')}
                  testID="comment-menu-button"
                />
              )}
              <Space width={s(5)} />
            </View>
            <SimplifyAnswer
              postId={item.postId}
              text={item.text}
              displayText={text}
              isAi={isAiComment(item.ownerId)}
            />
            <Reactions postId={item.postId} commentId={item.id} />
            {isAiComment(item.ownerId) && aiBookmark && (
              <>
                <View style={styles.aiActions}>
                  <BookmarkButton bookmark={aiBookmark} size={s(16)} />
                </View>
                <AiSources text={text} />
                <AiFeedbackButtons postId={item.postId} />
                <FollowUpQuestions postId={item.postId} />
              </>
            )}
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
        <ConfirmDialogComponent />
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
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  commentHeadLarge: {
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  flexOne: {
    flex: 1
  },
  sending: {
    marginLeft: s(6),
    fontStyle: 'italic'
  },
  aiActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: vs(4)
  }
})
