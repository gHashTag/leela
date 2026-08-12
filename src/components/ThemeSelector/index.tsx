import React, { memo, useCallback, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Switch,
  View,
  useColorScheme
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space } from '../Space'
import { Text } from '../TextComponents/Text'
import { dimGray, primary } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'
import {
  AppTheme,
  loadThemePreference,
  saveThemePreference,
  setAppTheme
} from '../../utils/themeSettings'

const ORDERED_THEMES: AppTheme[] = ['system', 'light', 'dark', 'highContrast']

const ThemeChip = memo(
  ({
    theme,
    selected,
    label,
    onSelect
  }: {
    theme: AppTheme
    selected: boolean
    label: string
    onSelect: (theme: AppTheme) => void
  }) => {
    const handlePress = useCallback(() => {
      triggerHaptic('impactLight')
      onSelect(theme)
    }, [onSelect, theme])

    return (
      <Pressable
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={handlePress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
      >
        <Text
          h="h10"
          title={label}
          oneColor={selected ? primary : dimGray}
        />
      </Pressable>
    )
  }
)

export const ThemeSelector = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [theme, setTheme] = useState<AppTheme | null>(null)

  useEffect(() => {
    let mounted = true
    loadThemePreference().then((value) => {
      if (mounted) {
        setTheme(value)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const selectTheme = useCallback(
    async (next: AppTheme) => {
      setTheme(next)
      setAppTheme(next)
      await saveThemePreference(next)
      // High-contrast changes benefit from an announcement for screen-reader
      // users because the visual change is not otherwise perceivable.
      if (next === 'highContrast') {
        AccessibilityInfo.announceForAccessibility(
          t('themeSelector.highContrastAnnouncement', {
            defaultValue: 'High contrast theme enabled'
          })
        )
      }
    },
    [t]
  )

  const toggleHighContrast = useCallback(() => {
    const next = theme === 'highContrast' ? 'system' : 'highContrast'
    selectTheme(next)
  }, [theme, selectTheme])

  if (theme === null) return null

  const chipLabels: Record<AppTheme, string> = {
    system: t('themeSelector.system', { defaultValue: 'System' }),
    light: t('themeSelector.light', { defaultValue: 'Light' }),
    dark: t('themeSelector.dark', { defaultValue: 'Dark' }),
    highContrast: t('themeSelector.highContrast', { defaultValue: 'High contrast' })
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="🎨" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('themeSelector.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(6)} />
      <View style={styles.controlRow}>
        <Text
          h="h10"
          title={t('themeSelector.description')}
          oneColor="#E0E0E0"
          textStyle={styles.flex}
        />
      </View>
      <Space height={vs(10)} />
      <View style={styles.chipRow}>
        {ORDERED_THEMES.map((t) => (
          <ThemeChip
            key={t}
            theme={t}
            selected={theme === t}
            label={chipLabels[t]}
            onSelect={selectTheme}
          />
        ))}
      </View>
      <Space height={vs(10)} />
      <View style={styles.highContrastRow}>
        <Text
          h="h10"
          title={t('themeSelector.highContrastShortcut')}
          oneColor="#E0E0E0"
          textStyle={styles.flex}
        />
        <Switch
          value={theme === 'highContrast'}
          onValueChange={toggleHighContrast}
          trackColor={{ false: dimGray, true: primary }}
          thumbColor="#FFFFFF"
          accessibilityRole="switch"
          accessibilityLabel={t('themeSelector.highContrastShortcut')}
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
    backgroundColor: 'rgba(255, 183, 77, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.30)'
  },
  containerDark: {
    backgroundColor: 'rgba(255, 183, 77, 0.18)'
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
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8)
  },
  chip: {
    paddingVertical: vs(6),
    paddingHorizontal: s(10),
    borderRadius: s(16),
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    minWidth: s(44),
    minHeight: s(44),
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipSelected: {
    backgroundColor: 'rgba(80, 227, 194, 0.22)',
    borderWidth: 1,
    borderColor: primary
  },
  highContrastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: vs(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)'
  }
})
