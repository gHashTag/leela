import { Share } from 'react-native'
import { useTranslation } from 'react-i18next'
import { captureException, OpenActionsModal } from '../../../constants'
import { useTypedNavigation } from '../../../hooks'
import { getUid } from '../../../screens/helper'
import { PostStore } from '../../../store'
import { PostT } from '../../../types/types'
import { buildReportLink } from '../../../utils'
import { useConfirmActions } from '../../../components/ConfirmAction'
import { triggerHaptic } from '../../../utils/haptics'

import { getActions } from './ModalActions'

interface usePostActionsParams {
  item?: PostT
  isDetail: boolean
  onPressCom?: () => void
  transText: string
  hideTranslate: boolean
}

export const usePostActions = ({
  item,
  isDetail,
  onPressCom,
  transText,
  hideTranslate
}: usePostActionsParams) => {
  const { t } = useTranslation()
  const { guardActions, ConfirmDialogComponent } = useConfirmActions(t)
  const { navigate } = useTypedNavigation()
  const isLiked =
    item?.liked?.findIndex((a) => a === getUid()) === -1 ? false : true

  function goDetail() {
    item &&
      navigate('DETAIL_POST_SCREEN', {
        postId: item.id,
        translatedText: transText,
        hideTranslate
      })
  }

  async function handleLike() {
    triggerHaptic(isLiked ? 'impactLight' : 'impactMedium')
    if (item && isLiked) {
      await PostStore.unlikePost(item.id)
    } else if (item && !isLiked) {
      await PostStore.likePost(item.id)
    }
  }

  function handleComment() {
    triggerHaptic('impactLight')
    onPressCom && onPressCom()
    if (!isDetail) {
      item && navigate('DETAIL_POST_SCREEN', { postId: item.id, comment: true })
    }
  }

  const handleAdminMenu = () => {
    const modalButtons = guardActions(getActions({ isDetail, item }))
    OpenActionsModal(modalButtons)
  }

  const handleProfile = () => {
    if (item?.ownerId) {
      navigate('USER_PROFILE_SCREEN', {
        ownerId: item.ownerId,
        editable: false
      })
    }
  }

  async function handleShareLink() {
    const { id, text, plan } = item || {}
    if (!id || !text) return

    try {
      const deepLink = await buildReportLink(id, text)
      await Share.share({
        title: t('report.shareTitle'),
        message: t('report.shareMessage', {
          plan,
          link: deepLink
        })
      })
    } catch (error) {
      captureException(error, 'usePostActions:handleShareLink')
    }
  }

  return {
    goDetail,
    handleLike,
    handleComment,
    handleAdminMenu,
    handleShareLink,
    isLiked,
    handleProfile,
    ConfirmDialogComponent
  }
}
