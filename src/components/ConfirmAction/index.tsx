import React, { useCallback, useState } from 'react'

import { ButtonsModalT } from '../../types/types'
import { ConfirmDialog } from '../ConfirmDialog'
import { triggerHaptic } from '../../utils/haptics'

type ConfirmKey =
  | 'DEL_POST'
  | 'BAN_USER'
  | 'HIDE_OR_ACCEPT'
  | 'BAN_AND_DEL'
  | 'DEL'
  | 'DEL_ALL_COM'
  | 'BAN'
  | 'START_OVER'

export interface DestructiveAction {
  key: ConfirmKey
  title: string
  message: string
  confirmTitle: string
  onConfirm: () => void
}

interface UseConfirmActionsResult {
  /** Pass into an action-sheet item list to guard destructive presses. */
  guardActions: (actions: ButtonsModalT[], overrides?: Partial<Record<ConfirmKey, string>>) => ButtonsModalT[]
  /** Render this dialog inside the screen that uses the actions. */
  ConfirmDialogComponent: React.FC
}

const KEY_CONFIG: Record<ConfirmKey, { destructive: boolean; titleKey: string; messageKey: string; confirmKey: string }> = {
  DEL_POST: {
    destructive: true,
    titleKey: 'confirm.deletePostTitle',
    messageKey: 'confirm.deletePostMessage',
    confirmKey: 'actions.delete'
  },
  BAN_USER: {
    destructive: true,
    titleKey: 'confirm.banUserTitle',
    messageKey: 'confirm.banUserMessage',
    confirmKey: 'confirm.ban'
  },
  HIDE_OR_ACCEPT: {
    destructive: false,
    titleKey: 'confirm.hidePostTitle',
    messageKey: 'confirm.hidePostMessage',
    confirmKey: 'confirm.hide'
  },
  BAN_AND_DEL: {
    destructive: true,
    titleKey: 'confirm.banAndDeleteTitle',
    messageKey: 'confirm.banAndDeleteMessage',
    confirmKey: 'confirm.banAndDelete'
  },
  DEL: {
    destructive: true,
    titleKey: 'confirm.deleteCommentTitle',
    messageKey: 'confirm.deleteCommentMessage',
    confirmKey: 'actions.delete'
  },
  DEL_ALL_COM: {
    destructive: true,
    titleKey: 'confirm.deleteAllCommentsTitle',
    messageKey: 'confirm.deleteAllCommentsMessage',
    confirmKey: 'confirm.deleteAll'
  },
  BAN: {
    destructive: true,
    titleKey: 'confirm.banUserTitle',
    messageKey: 'confirm.banUserMessage',
    confirmKey: 'confirm.ban'
  },
  START_OVER: {
    destructive: true,
    titleKey: 'confirm.resetTitle',
    messageKey: 'confirm.resetMessage',
    confirmKey: 'actions.startOver'
  }
}

export function useConfirmActions(t: (key: string) => string): UseConfirmActionsResult {
  const [pending, setPending] = useState<DestructiveAction | null>(null)

  const requestConfirm = useCallback(
    (action: DestructiveAction) => {
      triggerHaptic('notificationWarning')
      setPending(action)
    },
    []
  )

  const clearPending = useCallback(() => {
    setPending(null)
  }, [])

  const guardActions = useCallback(
    (actions: ButtonsModalT[]) => {
      return actions.map((action) => {
        const key = action.key as ConfirmKey
        const config = KEY_CONFIG[key]
        if (!config || !config.destructive) {
          return action
        }
        return {
          ...action,
          onPress: () =>
            requestConfirm({
              key,
              title: t(config.titleKey),
              message: t(config.messageKey),
              confirmTitle: t(config.confirmKey),
              onConfirm: action.onPress
            })
        }
      })
    },
    [requestConfirm, t]
  )

  const ConfirmDialogComponent = useCallback(() => {
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
        onConfirm={() => {
          clearPending()
          pending.onConfirm()
        }}
        onCancel={clearPending}
      />
    )
  }, [pending, clearPending, t])

  return { guardActions, ConfirmDialogComponent }
}
