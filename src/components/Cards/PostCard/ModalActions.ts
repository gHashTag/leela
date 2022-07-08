import { goBack } from '../../../constants'
import { OtherPlayers, PostStore } from '../../../store'
import { ButtonsModalT } from '../../../types'
import { PostT } from '../../../types'
type getActionsT = (props: getActionsProps) => ButtonsModalT[]
interface getActionsProps {
  item: PostT
  isDetail: boolean
}
export const getActions: getActionsT = ({ item, isDetail }) => {
  const isBaned =
    OtherPlayers.store.players.find(a => a.owner === item.ownerId)?.status === 'ban'
  return [
    {
      key: 'DEL_POST',
      color: 'red',
      onPress: () => {
        isDetail && goBack()
        PostStore.delPost(item.id)
      },
      title: 'Delete post',
      icon: 'delete-circle-outline'
    },
    {
      key: 'BAN_USER',
      color: isBaned ? undefined : 'red',
      onPress: () => PostStore.banUnbanUser(item.ownerId),
      title: isBaned ? 'Unban user' : 'Ban user',
      icon: isBaned ? 'account-plus-outline' : 'account-off-outline'
    },
    {
      key: 'BAN_AND_DEl',
      color: 'red',
      onPress: () => {
        isDetail && goBack()
        PostStore.delAllUserPosts(item.ownerId)
        PostStore.banUnbanUser(item.ownerId)
      },
      title: 'Ban and delete all posts',
      icon: 'emoticon-angry-outline'
    }
  ]
}
