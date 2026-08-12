import React, { memo, useCallback, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, Switch, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { dimGray, primary } from '../../constants'

const STORAGE_KEY = '@reducedMotionEnabled'

let reducedMotionEnabledGlobally = false

export function setReducedMotionEnabled(enabled: boolean): void {
  reducedMotionEnabledGlobally = enabled
}

export function isReducedMotionEnabled(): boolean {
  return reducedMotionEnabledGlobally
}

export const ReducedMotionToggle = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    import('@react-native-async-storage/async-storage').then((AsyncStorage) => {
      AsyncStorage.default
        .getItem(STORAGE_KEY)
        .then((raw) => {
          if (!mounted) return
          const value = raw === null ? false : raw === 'true'
          setEnabled(value)
          setReducedMotionEnabled(value)
        })
        .catch(() => {
          if (!mounted) return
          setEnabled(false)
        })
    })
    return () => {
      mounted = false
    }
  }, [])

  const toggle = useCallback(() => {
    if (enabled === null) return
    const next = !enabled
    setEnabled(next)
    setReducedMotionEnabled(next)
    import('@react-native-async-storage/async-storage').then((AsyncStorage) => {
      AsyncStorage.default.setItem(STORAGE_KEY, String(next)).catch(() => {
        // Storage failure is non-blocking.
      })
    })
  }, [enabled])

  if (enabled === null) return null

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="🎞" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('reducedMotionToggle.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(6)} />
      <View style={styles.controlRow}>
        <Text
          h="h10"
          title={t('reducedMotionToggle.description')}
          oneColor="#E0E0E0"
          textStyle={styles.flex}
        />
        <Space width={s(12)} />
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: dimGray, true: primary }}
          thumbColor="#FFFFFF"
          accessibilityRole="switch"
          accessibilityLabel={t('reducedMotionToggle.title')}
        />
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
    backgroundColor: 'rgba(179, 157, 219, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.30)'
  },
  containerDark: {
    backgroundColor: 'rgba(179, 157, 219, 0.18)'
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
  flex: {
    flex: 1
  }
})
