import { goBack } from '../../../constants'
import { OnlinePlayer, OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT } from '../../../types'
import { PostT } from '../../../types'
type getActionsT = (props: getActionsProps) => ButtonsModalT[]
interface getActionsProps {
  item: PostT
  isDetail: boolean
}
export const getActions: getActionsT = ({ item, isDetail }) => {
  const { id, ownerId, accept } = item
  const isBaned =
    OtherPlayers.store.players.find(a => a.owner === ownerId)?.status === 'ban'
  return [
    {
      key: 'DEL_POST',
      color: 'red',
      onPress: () => {
        isDetail && goBack()
        PostStore.delPost(id)
      },
      title: 'Delete post',
      icon: 'delete-circle-outline'
    },
    {
      key: 'BAN_USER',
      color: isBaned ? undefined : 'red',
      onPress: () => PostStore.banUnbanUser(ownerId),
      title: isBaned ? 'Unban user' : 'Ban user',
      icon: isBaned ? 'account-plus-outline' : 'account-off-outline'
    },
    {
      key: 'HIDE_OR_ACCEPT',
      color: accept ? 'red' : 'green',
      onPress: () => PostStore.acceptPost(accept, id),
      title: accept ? 'Hide report' : 'Accept report',
      icon: accept ? 'close-circle-outline' : 'check-circle-outline'
    },
    {
      key: 'BAN_AND_DEl',
      color: 'red',
      onPress: () => {
        isDetail && goBack()
        PostStore.delAllUserPosts(ownerId)
        PostStore.banUnbanUser(ownerId)
      },
      title: 'Ban and delete all posts',
      icon: 'emoticon-angry-outline'
    }
  ]
}
