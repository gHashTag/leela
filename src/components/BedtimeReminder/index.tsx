import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { dimGray, primary } from '../../constants'
import {
  BedtimeReminderSettings,
  loadBedtimeReminder,
  saveBedtimeReminder,
  scheduleBedtimeReminder
} from '../../utils/notifications/bedtimeReminder'

const MIN_HOUR = 18
const MAX_HOUR = 23

export const BedtimeReminder = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const [settings, setSettings] = useState<BedtimeReminderSettings | null>(null)

  useEffect(() => {
    let mounted = true
    loadBedtimeReminder().then((loaded) => {
      if (mounted) setSettings(loaded)
    })
    return () => {
      mounted = false
    }
  }, [])

  const updateSettings = useCallback(
    async (next: BedtimeReminderSettings) => {
      setSettings(next)
      await saveBedtimeReminder(next)
      await scheduleBedtimeReminder(t, next)
    },
    [t]
  )

  const toggleEnabled = useCallback(() => {
    if (!settings) return
    updateSettings({ ...settings, enabled: !settings.enabled })
  }, [settings, updateSettings])

  const adjustHour = useCallback(
    (delta: number) => {
      if (!settings) return
      const nextHour = Math.max(
        MIN_HOUR,
        Math.min(MAX_HOUR, settings.hour + delta)
      )
      if (nextHour === settings.hour) return
      updateSettings({ ...settings, hour: nextHour })
    },
    [settings, updateSettings]
  )

  const timeLabel = useMemo(() => {
    if (!settings) return ''
    const hh = String(settings.hour).padStart(2, '0')
    const mm = String(settings.minute).padStart(2, '0')
    return `${hh}:${mm}`
  }, [settings])

  if (!settings) return null

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="🌙" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('bedtimeReminder.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(6)} />
      <Text h="h10" title={t('bedtimeReminder.description')} oneColor="#E0E0E0" />
      <Space height={vs(10)} />
      <View style={styles.controlRow}>
        <View style={styles.timeRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => adjustHour(-1)}
            style={styles.stepButton}
            accessibilityRole="button"
            accessibilityLabel={t('bedtimeReminder.decrease')}
          >
            <Text h="h8" title="−" oneColor={primary} />
          </TouchableOpacity>
          <Space width={s(12)} />
          <Text h="h8" title={timeLabel} oneColor="#FFFFFF" />
          <Space width={s(12)} />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => adjustHour(1)}
            style={styles.stepButton}
            accessibilityRole="button"
            accessibilityLabel={t('bedtimeReminder.increase')}
          >
            <Text h="h8" title="+" oneColor={primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.toggleRow}>
          <Text h="h10" title={t('bedtimeReminder.enabled')} oneColor="#FFFFFF" />
          <Space width={s(8)} />
          <Switch
            value={settings.enabled}
            onValueChange={toggleEnabled}
            trackColor={{ false: dimGray, true: primary }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel={t('bedtimeReminder.enabled')}
          />
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(10),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(80, 227, 194, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.4)'
  },
  containerDark: {
    backgroundColor: 'rgba(80, 227, 194, 0.20)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stepButton: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    backgroundColor: 'rgba(80, 227, 194, 0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  }
})
