import React, { memo, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { brightTurquoise, dimGray, primary } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'
import { useAppTheme } from '../../utils/useAppTheme'

interface StatusRowT {
  label: string
  active: boolean
}

const StatusRow = memo(({ label, active }: StatusRowT) => (
  <View style={styles.row}>
    <View style={[styles.dot, active && styles.dotActive]} />
    <Space width={s(8)} />
    <Text h="h10" title={label} oneColor={active ? undefined : dimGray} />
  </View>
))

export const AccessibilityStatusCard = memo(() => {
  const { t } = useTranslation()
  const theme = useAppTheme()

  const [screenReader, setScreenReader] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [boldText, setBoldText] = useState(false)
  const [highContrast, setHighContrast] = useState(theme === 'highContrast')

  useEffect(() => {
    let mounted = true
    const read = async () => {
      try {
        const [sr, rm, bt] = await Promise.all([
          AccessibilityInfo.isScreenReaderEnabled(),
          AccessibilityInfo.isReduceMotionEnabled(),
          AccessibilityInfo.isBoldTextEnabled?.() ?? Promise.resolve(false)
        ])
        if (mounted) {
          setScreenReader(sr)
          setReduceMotion(rm)
          setBoldText(bt)
        }
      } catch {
        // Best-effort read.
      }
    }
    read()
    const listeners = [
      AccessibilityInfo.addEventListener('screenReaderChanged', (v) => {
        if (mounted) setScreenReader(v)
      }),
      AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
        if (mounted) setReduceMotion(v)
      })
    ]
    if (AccessibilityInfo.addEventListener) {
      // Bold text changed event is iOS-only and may not exist in older RN.
      try {
        listeners.push(
          AccessibilityInfo.addEventListener('boldTextChanged' as any, (v: boolean) => {
            if (mounted) setBoldText(v)
          })
        )
      } catch {
        // Ignore if event is unsupported.
      }
    }
    return () => {
      mounted = false
      listeners.forEach((l) => l?.remove?.())
    }
  }, [])

  useEffect(() => {
    setHighContrast(theme === 'highContrast')
  }, [theme])

  const openSettings = () => {
    triggerHaptic('impactLight')
    Linking.openURL('app-settings:').catch(() => {
      // Fallback is a no-op; the card still shows current status.
    })
  }

  return (
    <View style={styles.container} testID="accessibility-status-card">
      <View style={styles.titleRow}>
        <Text h="h11" title="♿" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('accessibilityStatus.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(8)} />
      <StatusRow
        label={t('accessibilityStatus.voiceOver')}
        active={screenReader}
      />
      <StatusRow
        label={t('accessibilityStatus.reduceMotion')}
        active={reduceMotion}
      />
      <StatusRow
        label={t('accessibilityStatus.boldText')}
        active={boldText}
      />
      <StatusRow
        label={t('accessibilityStatus.highContrast')}
        active={highContrast}
      />
      <Space height={vs(8)} />
      <Pressable
        onPress={openSettings}
        style={styles.linkRow}
        accessibilityRole="button"
        accessibilityLabel={t('accessibilityStatus.openSettings')}
      >
        <Text
          h="h10"
          title={t('accessibilityStatus.openSettings')}
          oneColor={brightTurquoise}
        />
      </Pressable>
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
    backgroundColor: 'rgba(80, 227, 194, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.30)'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: vs(3)
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: dimGray
  },
  dotActive: {
    backgroundColor: primary
  },
  linkRow: {
    alignSelf: 'flex-start',
    paddingVertical: vs(4)
  }
})
