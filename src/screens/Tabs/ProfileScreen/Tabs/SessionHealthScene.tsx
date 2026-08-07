import React from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Button, Space, Text } from '../../../../components'
import { captureException } from '../../../../constants'
import { useSessionHealth } from '../../../../hooks'
import {
  clearSessionHealth,
  CrashFreeSessionStatus,
  markSessionStarted
} from '../../../../utils/sessionHealth'

const statusColor: Record<CrashFreeSessionStatus, string> = {
  ok: '#50E3C2',
  crashed: '#FF3B30',
  unknown: '#949494'
}

export const SessionHealthScene = observer(() => {
  const { t } = useTranslation()
  const { status, startedAt, isOnline } = useSessionHealth()

  const handleReset = async () => {
    try {
      await clearSessionHealth()
      await markSessionStarted()
    } catch (error) {
      captureException(error, 'SessionHealthScene: reset')
    }
  }

  const statusLabel =
    status === 'ok'
      ? t('sessionHealth.statusOk')
      : status === 'crashed'
      ? t('sessionHealth.statusCrashed')
      : t('sessionHealth.statusUnknown')

  return (
    <View style={styles.container}>
      <Space height={vs(20)} />
      <View
        style={[
          styles.badge,
          {
            backgroundColor: statusColor[status],
            opacity: status === 'unknown' ? 0.3 : 1
          }
        ]}
        accessibilityRole="adjustable"
        accessibilityLabel={t('sessionHealth.accessibilityLabel', {
          status: statusLabel
        })}
      >
        <Text h="h5" title={statusLabel} textStyle={styles.badgeText} />
      </View>
      <Space height={vs(16)} />
      <Text
        h="h6"
        title={t('sessionHealth.startedAt', {
          time: new Date(startedAt).toLocaleString()
        })}
        textStyle={styles.detail}
      />
      <Space height={vs(8)} />
      <Text
        h="h7"
        title={
          isOnline
            ? t('sessionHealth.onlineNote')
            : t('sessionHealth.offlineNote')
        }
        textStyle={styles.detail}
      />
      <Space height={vs(24)} />
      <Button title={t('sessionHealth.reset')} onPress={handleReset} />
      <Space height={vs(20)} />
      <Text
        h="h8"
        title={t('sessionHealth.explanation')}
        textStyle={styles.explanation}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: s(20)
  },
  badge: {
    paddingHorizontal: s(24),
    paddingVertical: vs(12),
    borderRadius: s(8)
  },
  badgeText: {
    color: '#1c1c1c',
    textAlign: 'center'
  },
  detail: {
    textAlign: 'center'
  },
  explanation: {
    textAlign: 'center',
    opacity: 0.7
  }
})
