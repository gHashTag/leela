import { Share } from 'react-native'
import { OpenActionsModal } from 'src/constants'
import { useTypedNavigation } from 'src/hooks'
import { getUid } from 'src/screens/helper'
import { PostStore } from 'src/store'
import { PostT } from 'src/types'
import { buildReportLink } from 'src/utils'

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
    if (item && isLiked) {
      await PostStore.unlikePost(item.id)
    } else if (item && !isLiked) {
      await PostStore.likePost(item.id)
    }
  }

  function handleComment() {
    onPressCom && onPressCom()
    if (!isDetail) {
      item && navigate('DETAIL_POST_SCREEN', { postId: item.id, comment: true })
    }
  }

  const handleAdminMenu = () => {
    const modalButtons = getActions({ isDetail, item })
    OpenActionsModal(modalButtons)
  }

  const handleProfile = () => {
    if (item?.ownerId) {
      navigate('USER_PROFILE_SCREEN', { ownerId: item.ownerId })
    }
  }

  async function handleShareLink() {
    const { id, text } = item || {}
    if (id && text) {
      const deepLink = await buildReportLink(id, text)
      Share.share({
        title: 'Leela Chakra',
        message: deepLink
      })
    }
  }

  return {
    goDetail,
    handleLike,
    handleComment,
    handleAdminMenu,
    handleShareLink,
    isLiked,
    handleProfile
  }
}
