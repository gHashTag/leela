import Clipboard from '@react-native-clipboard/clipboard'
import { navigate } from '../../../constants'
import i18next from '../../../i18n'

import { getUid } from '../../../screens/helper'
import { OnlinePlayer, OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT, ReplyComT } from '../../../types/types'

type getActionsT = (props: getActionsProps) => ButtonsModalT[]
interface getActionsProps {
  item: ReplyComT
  handleTransText: () => void
  hideTranslate: boolean
}

export const getActions: getActionsT = ({
  item,
  handleTransText,
  hideTranslate
}) => {
  const isOwner = getUid() === item.ownerId
  const isAdmin = OnlinePlayer.store.status === 'Admin'
  const isBaned =
    OtherPlayers.store.players.find((a) => a.owner === item.ownerId)?.status ===
    'ban'
  const replyTargetName = item.replyToOwnerName
  const parentReplyId = item.parentReplyId || item.id

  return [
    {
      key: 'REPLY_THREAD',
      onPress: () => {
        navigate('INPUT_TEXT_MODAL', {
          initialText: `@${PostStore.getOwnerName(item.ownerId, false) || ''} `,
          onSubmit: (text: string) =>
            PostStore.replyComment({
              text,
              commentId: item.commentId,
              commentOwner: item.commentOwner,
              postId: item.postId,
              parentReplyId,
              replyToOwnerName: PostStore.getOwnerName(item.ownerId, false)
            })
        })
      },
      title: i18next.t('actions.replyThread'),
      icon: 'chatbubbles-outline'
    },
    {
      key: 'EDIT',
      onPress: () => {
        navigate('INPUT_TEXT_MODAL', {
          initialText: item.text,
          onSubmit: async (text: string) => {
            await PostStore.editComment({
              commentId: item.id,
              text,
              isReply: item.reply
            })
          }
        })
      },
      title: i18next.t('actions.edit'),
      icon: 'square-edit-outline'
    },
    {
      key: 'COPY',
      onPress: () => Clipboard.setString(item.text),
      title: i18next.t('actions.copy'),
      icon: 'content-copy'
    },
    {
      key: 'TRANSLATE',
      onPress: handleTransText,
      title: i18next.t('actions.translate'),
      icon: !hideTranslate ? 'translate-off' : 'translate'
    },
    {
      key: 'DEL',
      onPress: () => {
        PostStore.delComment({
          commentId: item.id,
          isReply: item.reply,
          postId: item.postId
        })
      },
      title: i18next.t('actions.delete'),
      color: 'red',
      icon: 'delete-outline'
    },
    {
      key: 'DEL_ALL_COM',
      onPress: () => {
        PostStore.delAllUserComments(item.ownerId)
      },
      title: 'delete all user comments',
      color: 'red',
      icon: 'delete-alert-outline'
    },
    {
      key: 'BAN',
      onPress: () => {
        PostStore.banUnbanUser(item.ownerId)
      },
      title: isBaned ? 'Unban user' : 'Ban user',
      color: isBaned ? undefined : 'red',
      icon: isBaned ? 'account-plus-outline' : 'account-off-outline'
    }
  ]
    .filter((a) =>
      isOwner || isAdmin ? true : a.key !== 'EDIT' && a.key !== 'DEL'
    )
    .filter((a) =>
      isAdmin ? true : a.key !== 'DEL_ALL_COM' && a.key !== 'BAN'
    )
}
