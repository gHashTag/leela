import React, { useState } from 'react'

import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { useTypedNavigation } from '../../../hooks'

import { getActions } from './ModalActions'

import {
  ConfirmDialog,
  HashtagFormat,
  PlanAvatar,
  ProBadge,
  Reactions,
  Space,
  Text
} from '../../'
import { OpenActionsModal, fuchsia, lightGray } from '../../../constants'
import { getTimeStamp } from '../../../screens/helper'
import { PostStore } from '../../../store'
import { ReplyComT } from '../../../types/types'
import { ButtonVectorIcon } from '../../Buttons'
import { useConfirmActions } from '../../ConfirmAction'
import { useTranslation } from 'react-i18next'
import { useFontScale } from '../../../utils/fontScale'

interface SubComT {
  item: ReplyComT
  index: number
}

export function SubCommentCard({ item }: SubComT) {
  const [hideTranslate, setHideTranslate] = useState(true)
  const [transText, setTransText] = useState('')
  const { navigate } = useTypedNavigation()
  const fontScale = useFontScale()
  const isAccessibilityScale = fontScale >= 1.35
  const { t } = useTranslation()
  const { ConfirmDialogComponent, guardActions } = useConfirmActions(t)

  const date = getTimeStamp({ lastTime: item.createTime, type: '-short' })
  const avaUrl = PostStore.getAvaById(item.ownerId)

  async function handleTransText() {
    if (hideTranslate && transText === '') {
      const translated = await PostStore.translateText(item.text)
      setTransText(translated)
    }
    setHideTranslate((pr) => !pr)
  }

  const OpenModal = () => {
    const modalButtons = guardActions(
      getActions({ handleTransText, hideTranslate, item })
    )
    OpenActionsModal(modalButtons)
  }

  const handleProfile = () => {
    if (item?.ownerId) {
      navigate('USER_PROFILE_SCREEN', {
        ownerId: item?.ownerId,
        editable: false
      })
    }
  }
  const text = hideTranslate ? item.text : transText
  const curName = PostStore.getOwnerName(item.ownerId, false)
  return (
    <View style={styles.container}>
      <View style={styles.commentHead}>
        <PlanAvatar
          avaUrl={avaUrl}
          isAccept={true}
          onPress={handleProfile}
          plan={PostStore.getComPlan(item.ownerId)}
          size="small"
        />
        <Space width={s(6)} />
        <View style={styles.infoContainer}>
          <View
            style={[
              styles.infoLine,
              isAccessibilityScale && styles.infoLineLarge
            ]}
          >
            <Text
              numberOfLines={isAccessibilityScale ? 2 : 1}
              h={'h6'}
              title={curName as string}
            />
            {/* @ts-expect-error ReplyComT historically lacks `pro` in the
                type, but runtime objects include it for replies made by pro
                users. */}
            {Boolean((item as any).pro) && (
              <>
                <Space width={s(6)} />
                <ProBadge small />
              </>
            )}
            <Text
              numberOfLines={isAccessibilityScale ? 2 : 1}
              h={'h6'}
              title={` ${date}`}
              oneColor={lightGray}
            />
          </View>
        </View>
        <ButtonVectorIcon
          size={s(10)}
          name="chevron-down"
          onPress={OpenModal}
          accessibilityLabel={t('accessibility.commentMenu')}
          testID="sub-comment-menu-button"
        />
        <Space width={s(8)} />
      </View>
      <Space height={vs(3)} />
      <View style={styles.textContainer}>
        <Space width={s(5)} />
        <HashtagFormat hashTagColor={fuchsia} title={text} h="h6" selectable />
      </View>
      <View style={styles.reactionsContainer}>
        <Space width={s(5)} />
        <Reactions postId={item.postId} commentId={item.id} />
      </View>
      <ConfirmDialogComponent />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: vs(5)
  },
  infoLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  infoLineLarge: {
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  infoContainer: {
    flexDirection: 'column',
    flex: 1
  },
  commentHead: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  textContainer: {
    flexDirection: 'row'
  },
  reactionsContainer: {
    flexDirection: 'row'
  }
})
