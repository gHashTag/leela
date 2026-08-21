import React, { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme
} from 'react-native'
import { s, vs } from 'react-native-size-matters'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { ButtonWithIcon, Space, Text } from '../../components'
import { captureException, dimGray, white } from '../../constants'

const LAST_OPEN_KEY = '@lastAppOpen'
const WELCOME_BACK_SEEN_KEY = '@welcomeBackSeen'
const INACTIVITY_DAYS = 7
const DAY_MS = 1000 * 60 * 60 * 24

const getLocalDateString = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().split('T')[0]
}

const daysBetween = (earlier: Date, later: Date) => {
  const earlierLocal = getLocalDateString(earlier)
  const laterLocal = getLocalDateString(later)

  const [eYear, eMonth, eDay] = earlierLocal.split('-').map(Number)
  const [lYear, lMonth, lDay] = laterLocal.split('-').map(Number)

  const e = new Date(eYear, eMonth - 1, eDay)
  const l = new Date(lYear, lMonth - 1, lDay)

  return Math.floor((l.getTime() - e.getTime()) / DAY_MS)
}

export const WelcomeBack = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkInactivity = async () => {
      try {
        const now = new Date()
        const today = getLocalDateString(now)
        const lastOpenRaw = await AsyncStorage.getItem(LAST_OPEN_KEY)
        const seenDate = await AsyncStorage.getItem(WELCOME_BACK_SEEN_KEY)

        if (seenDate === today) return

        if (lastOpenRaw) {
          const lastOpen = new Date(Number(lastOpenRaw))
          const diffDays = daysBetween(lastOpen, now)

          if (diffDays >= INACTIVITY_DAYS && mounted) {
            setVisible(true)
            await AsyncStorage.setItem(WELCOME_BACK_SEEN_KEY, today)
          }
        }

        await AsyncStorage.setItem(LAST_OPEN_KEY, String(now.getTime()))
      } catch (error) {
        captureException(error, 'WelcomeBack: checkInactivity')
      }
    }

    checkInactivity()

    return () => {
      mounted = false
    }
  }, [])

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Pressable onPress={() => setVisible(false)} style={styles.closeRow}>
            <Text h="h5" title="✕" />
          </Pressable>
          <Text
            h="h2"
            title={t('welcomeBack.title')}
            textStyle={styles.title}
          />
          <Space height={vs(8)} />
          <Text
            h="h6"
            title={t('welcomeBack.body')}
            oneColor={dimGray}
            textStyle={styles.body}
          />
          <Space height={vs(16)} />
          <ButtonWithIcon
            iconName="play-outline"
            title={t('welcomeBack.continue')}
            onPress={() => setVisible(false)}
          />
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(24)
  },
  card: {
    backgroundColor: white,
    borderRadius: s(20),
    paddingHorizontal: s(20),
    paddingTop: s(16),
    paddingBottom: s(24),
    width: '100%'
  },
  cardDark: {
    backgroundColor: '#1c1c1c'
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding: s(4)
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center'
  },
  body: {
    textAlign: 'center'
  }
})
