import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { OpenActionsModal, captureException } from '../../constants'
import { OnlinePlayer } from '../../store'
import { ButtonsModalT } from '../../types'

export const useActions = () => {
  const [loadImage, setLoadImage] = useState(false)
  const { t } = useTranslation()
  const onPressChangeAva = async () => {
    setLoadImage(true)
    try {
      await OnlinePlayer.uploadImage()
    } catch (error) {
      captureException(error)
    }
    setLoadImage(false)
  }

  // const onPressShare = async () => {
  //   console.log('SHARE')
  // }

  const menuItems: ButtonsModalT[] = [
    {
      key: 'EDIT',
      onPress: onPressChangeAva,
      title: t('actions.changeAva'),
      icon: 'ios-images-outline',
    },
    // {
    //   key: 'SHARE',
    //   onPress: onPressShare,
    //   title: I18n.t('actions.shareProfile'),
    //   icon: 'share-outline'
    // },
    {
      key: 'EXIT',
      color: 'red',
      onPress: OnlinePlayer.SignOut,
      title: t('auth.signOut'),
      icon: 'ios-exit-outline',
    },
    {
      key: 'RESET',
      color: 'red',
      onPress: OnlinePlayer.resetGame,
      title: t('actions.startOver'),
      icon: 'ios-reload',
    },
  ]

  const onPressEdit = () => OpenActionsModal(menuItems)

  return { loadImage, onPressEdit }
}
