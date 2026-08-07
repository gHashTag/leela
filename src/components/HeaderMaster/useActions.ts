import auth from '@react-native-firebase/auth'
import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'

import { OpenActionsModal, captureException } from '../../constants'
import { OnlinePlayer } from '../../store'
import { ButtonsModalT } from '../../types/types'
import { buildReferralLink } from '../../utils/linking/linkHelpers'

export const useActions = () => {
  const { t } = useTranslation()

  const onPressShare = async () => {
    try {
      const referralCode = auth().currentUser?.uid || 'guest'
      const link = await buildReferralLink(referralCode)

      if (link && link !== 'error') {
        await Share.share({
          title: t('referral.shareTitle'),
          message: t('referral.shareMessage', { link })
        })
      }
    } catch (error) {
      captureException(error, 'useActions:onPressShare')
    }
  }

  const menuItems: ButtonsModalT[] = [
    {
      key: 'INVITE',
      onPress: onPressShare,
      title: t('referral.shareTitle'),
      icon: 'share-outline'
    },
    {
      key: 'EXIT',
      color: 'red',
      onPress: OnlinePlayer.SignOut,
      title: t('auth.signOut'),
      icon: 'ios-exit-outline'
    },
    {
      key: 'RESET',
      color: 'red',
      onPress: OnlinePlayer.resetGame,
      title: t('actions.startOver'),
      icon: 'ios-reload'
    },
    {
      key: 'DELETE',
      color: 'red',
      onPress: OnlinePlayer.deleteUser,
      title: t('actions.deleteAcc'),
      icon: 'trash-bin-outline'
    }
  ]

  const onPressEdit = () => OpenActionsModal(menuItems)

  return { onPressEdit }
}
