import React, { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { fuchsia, white } from '../../constants'
import {
  formatCountdown,
  getTimeLeft,
  getTrialDeadline,
  TimeLeftT
} from '../../utils/trialTimer'

const UPDATE_INTERVAL = 1000

export const TrialTimer = () => {
  const { t } = useTranslation()
  const [deadline, setDeadline] = useState<number | null>(null)
  const [left, setLeft] = useState<TimeLeftT | null>(null)

  useEffect(() => {
    let mounted = true
    getTrialDeadline().then((d) => {
      if (mounted) {
        setDeadline(d)
        setLeft(getTimeLeft(d))
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => {
      setLeft(getTimeLeft(deadline))
    }, UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [deadline])

  if (!left) return null

  return (
    <View style={styles.container}>
      <Text h="h5" title="🔥" />
      <Space width={s(6)} />
      <View>
        <Text
          h="h7"
          title={t('trialTimer.title')}
          textStyle={styles.title}
          oneColor={white}
        />
        <Text
          h="h4"
          title={formatCountdown(left, t)}
          oneColor={white}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fuchsia,
    borderRadius: s(12),
    paddingHorizontal: s(16),
    paddingVertical: vs(10),
    marginHorizontal: s(20),
    marginBottom: vs(10)
  },
  title: {
    opacity: 0.9
  }
})
