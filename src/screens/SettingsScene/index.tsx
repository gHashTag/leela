import React, { memo, useCallback, useEffect, useState } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  AccessibilityStatusCard,
  AppContainer,
  HapticToggle,
  ReducedMotionToggle,
  SettingsRow,
  Space,
  Text,
  ThemeSelector
} from '../../components'
import { primary } from '../../constants'
import { RootStackParamList } from '../../types/types'
import { getForceAiLanguage, setForceAiLanguage } from '../../utils/aiLanguage'
import { loadSoundEnabled, saveSoundEnabled } from '../../utils/soundSettings'

interface SectionT {
  title: string
  rows: {
    key: string
    title: string
    subtitle?: string
    icon?: string
    toggle?: boolean
    value?: boolean
    valueLabel?: string
    onPress?: () => void
    testID?: string
  }[]
}

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'SETTINGS_SCENE'
>

export const SettingsScene = memo(
  ({ navigation }: { navigation: navigation }) => {
    const { t } = useTranslation()
    const [sound, setSound] = useState<boolean | null>(null)
    const [aiLang, setAiLang] = useState<boolean | null>(null)

    useEffect(() => {
      let mounted = true
      Promise.all([loadSoundEnabled(), getForceAiLanguage()]).then(
        ([soundValue, aiValue]) => {
          if (mounted) {
            setSound(soundValue)
            setAiLang(aiValue)
          }
        }
      )
      return () => {
        mounted = false
      }
    }, [])

    const toggleSound = useCallback(() => {
      if (sound === null) return
      const next = !sound
      setSound(next)
      saveSoundEnabled(next)
    }, [sound])

    const toggleAiLanguage = useCallback(() => {
      if (aiLang === null) return
      const next = !aiLang
      setAiLang(next)
      setForceAiLanguage(next)
    }, [aiLang])

    const sections: SectionT[] = [
      {
        title: t('settings.experience'),
        rows: [
          {
            key: 'sound',
            title: t('soundToggle.title'),
            subtitle: t('soundToggle.description'),
            icon: '🔊',
            toggle: true,
            value: sound ?? false,
            onPress: toggleSound,
            testID: 'settings-sound'
          },
          {
            key: 'haptics',
            title: t('hapticToggle.title'),
            subtitle: t('hapticToggle.description'),
            icon: '📳'
          },
          {
            key: 'reducedMotion',
            title: t('reducedMotionToggle.title'),
            subtitle: t('reducedMotionToggle.description'),
            icon: '🎞'
          },
          {
            key: 'accessibility',
            title: t('accessibilityStatus.title'),
            subtitle: t('accessibilityStatus.subtitle'),
            icon: '♿'
          },
          {
            key: 'theme',
            title: t('themeSelector.title'),
            subtitle: t('themeSelector.description'),
            icon: '🎨'
          }
        ]
      },
      {
        title: t('settings.ai'),
        rows: [
          {
            key: 'aiLanguage',
            title: t('aiLanguage.title'),
            subtitle: t('aiLanguage.description'),
            icon: '🌐',
            toggle: true,
            value: aiLang ?? false,
            onPress: toggleAiLanguage,
            testID: 'settings-ai-language'
          },
          {
            key: 'aiPersona',
            title: t('settings.aiPersona'),
            valueLabel: t('aiPersona.tab'),
            icon: '🧭',
            onPress: () =>
              navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_3' }),
            testID: 'settings-ai-persona'
          }
        ]
      },
      {
        title: t('settings.reminders'),
        rows: [
          {
            key: 'bedtime',
            title: t('settings.bedtimeReminder'),
            icon: '🌙',
            onPress: () =>
              navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_3' }),
            testID: 'settings-bedtime'
          }
        ]
      },
      {
        title: t('settings.account'),
        rows: [
          {
            key: 'editProfile',
            title: t('settings.editProfile'),
            icon: '✏️',
            onPress: () => navigation.navigate('USER_EDIT' as any),
            testID: 'settings-edit-profile'
          },
          {
            key: 'subscription',
            title: t('settings.subscription'),
            icon: '⭐',
            onPress: () => navigation.navigate('SUBSCRIPTION_SCREEN' as any),
            testID: 'settings-subscription'
          }
        ]
      }
    ]

    return (
      <AppContainer
        title={t('settings.title')}
        iconLeft=":arrow_left:"
        onPress={() => navigation.goBack()}
        textAlign="center"
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text
                h="h10"
                title={section.title}
                oneColor={primary}
                textStyle={styles.sectionTitle}
              />
              <Space height={vs(8)} />
              <View style={styles.card}>
                {section.rows.map((row, index) => (
                  <View key={row.key}>
                    {row.key === 'haptics' && <HapticToggle />}
                    {row.key === 'reducedMotion' && <ReducedMotionToggle />}
                    {row.key === 'theme' && <ThemeSelector />}
                    {row.key === 'accessibility' && <AccessibilityStatusCard />}
                    {row.key !== 'haptics' &&
                      row.key !== 'reducedMotion' &&
                      row.key !== 'theme' &&
                      row.key !== 'accessibility' && <SettingsRow {...row} />}
                    {index < section.rows.length - 1 && (
                      <View style={styles.divider} />
                    )}
                  </View>
                ))}
              </View>
              <Space height={vs(18)} />
            </View>
          ))}
        </ScrollView>
      </AppContainer>
    )
  }
)

const styles = StyleSheet.create({
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: s(16),
    paddingBottom: vs(32)
  },
  section: {
    width: '100%'
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: s(8)
  },
  card: {
    borderRadius: s(16),
    overflow: 'hidden'
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginLeft: s(16)
  }
})
