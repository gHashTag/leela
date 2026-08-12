import auth from '@react-native-firebase/auth'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { OpenActionsModal, captureException } from '../../constants'
import { OnlinePlayer } from '../../store'
import { ButtonsModalT } from '../../types/types'
import { buildReferralLink } from '../../utils/linking/linkHelpers'
import { triggerHaptic } from '../../utils/haptics'

type DestructiveAction = 'signOut' | 'reset' | 'delete'

interface PendingConfirm {
  action: DestructiveAction
  title: string
  message: string
  confirmTitle: string
  onConfirm: () => void
}

const ACTION_CONFIG: Record<
  DestructiveAction,
  { titleKey: string; messageKey: string; confirmKey: string }
> = {
  signOut: {
    titleKey: 'confirm.signOutTitle',
    messageKey: 'confirm.signOutMessage',
    confirmKey: 'auth.signOut'
  },
  reset: {
    titleKey: 'confirm.resetTitle',
    messageKey: 'confirm.resetMessage',
    confirmKey: 'actions.startOver'
  },
  delete: {
    titleKey: 'confirm.deleteTitle',
    messageKey: 'confirm.deleteMessage',
    confirmKey: 'actions.deleteAcc'
  }
}

export const useActions = () => {
  const { t } = useTranslation()
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const onPressShare = useCallback(async () => {
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
  }, [t])

  const confirmDestructive = useCallback(
    (action: DestructiveAction, onConfirm: () => void) => {
      triggerHaptic('notificationWarning')
      const config = ACTION_CONFIG[action]
      setPending({
        action,
        title: t(config.titleKey),
        message: t(config.messageKey),
        confirmTitle: t(config.confirmKey),
        onConfirm
      })
    },
    [t]
  )

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
      onPress: () => confirmDestructive('signOut', OnlinePlayer.SignOut),
      title: t('auth.signOut'),
      icon: 'ios-exit-outline'
    },
    {
      key: 'RESET',
      color: 'red',
      onPress: () => confirmDestructive('reset', OnlinePlayer.resetGame),
      title: t('actions.startOver'),
      icon: 'ios-reload'
    },
    {
      key: 'DELETE',
      color: 'red',
      onPress: () => confirmDestructive('delete', OnlinePlayer.deleteUser),
      title: t('actions.deleteAcc'),
      icon: 'trash-bin-outline'
    }
  ]

  const onPressEdit = useCallback(() => {
    triggerHaptic('impactLight')
    OpenActionsModal(menuItems)
  }, [menuItems])

  const onCancelConfirm = useCallback(() => {
    setPending(null)
  }, [])

  const onConfirmAction = useCallback(() => {
    setPending(null)
    pending?.onConfirm()
  }, [pending])

  const ConfirmActionsDialog = useCallback(() => {
    if (!pending) {
      return null
    }
    return (
      <ConfirmDialog
        visible={!!pending}
        title={pending.title}
        message={pending.message}
        confirmTitle={pending.confirmTitle}
        cancelTitle={t('actions.cancel')}
        destructive
        onConfirm={onConfirmAction}
        onCancel={onCancelConfirm}
      />
    )
  }, [pending, t, onConfirmAction, onCancelConfirm])

  return { onPressEdit, ConfirmActionsDialog }
}
