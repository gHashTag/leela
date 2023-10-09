import Clipboard from '@react-native-clipboard/clipboard'
import { navigate } from '../../../constants'
import i18next from '../../../i18n'
import { getUid } from '../../../screens/helper'
import { OnlinePlayer, OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT, CommentT } from '../../../types/types'

type getActionsT = (props: getActionsProps) => ButtonsModalT[]
interface getActionsProps {
  item: CommentT
  handleTransText: () => void
}
export const getActions: getActionsT = ({ item }) => {
  const isOwner = getUid() === item.ownerId
  const isAdmin = OnlinePlayer.store.status === 'Admin'
  const isBaned =
    OtherPlayers.store.players.find((a) => a.owner === item.ownerId)?.status ===
    'ban'
  return [
    {
      key: 'REPLY',
      onPress: () => {
        navigate('INPUT_TEXT_MODAL', {
          onSubmit: (text: string) =>
            PostStore.replyComment({
              text,
              commentId: item.id,
              commentOwner: item.ownerId,
              postId: item.postId
            })
        })
      },
      title: i18next.t('actions.reply'),
      icon: 'ios-paper-plane-outline'
    },
    {
      key: 'COPY',
      onPress: () => {
        Clipboard.setString(item.text)
      },
      title: i18next.t('actions.copy'),
      icon: 'ios-copy-outline'
    },
    // {
    //   key: 'TRANSLATE',
    //   onPress: handleTransText,
    //   title: i18next.t('actions.translate'),
    //   icon: 'ios-language-outline',
    // },
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
      icon: 'md-trash-outline'
    },
    {
      key: 'DEL_ALL_COM',
      onPress: () => {
        PostStore.delAllUserComments(item.ownerId)
      },
      title: 'delete all user comments',
      color: 'red',
      icon: 'md-warning-outline'
    },
    {
      key: 'BAN',
      onPress: () => {
        PostStore.banUnbanUser(item.ownerId)
      },
      title: isBaned ? 'Unban user' : 'Ban user',
      color: isBaned ? undefined : 'red',
      icon: isBaned ? 'person-add-outline' : 'person-remove-outline'
    }
  ]
    .filter((a) => (isOwner ? true : isAdmin ? true : a.key !== 'DEL'))
    .filter((a) =>
      isAdmin ? true : a.key !== 'DEL_ALL_COM' && a.key !== 'BAN'
    )
}
