import Clipboard from '@react-native-clipboard/clipboard'
import i18next from 'src/i18n'

import { getUid } from '../../../screens/helper'
import { OnlinePlayer, OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT, ReplyComT } from '../../../types'

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
  return [
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
    .filter((a) => (isOwner ? true : isAdmin ? true : a.key !== 'DEL'))
    .filter((a) =>
      isAdmin ? true : a.key !== 'DEL_ALL_COM' && a.key !== 'BAN'
    )
}
