import React, { memo, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  View,
  useColorScheme
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { captureException, dimGray, white } from '../../constants'
import { loadEntries, getLocalDateString } from '../StreakJournal'

const MILESTONE_DAYS = 7
const MILESTONE_SEEN_KEY = '@streakMilestoneSeen'

import AsyncStorage from '@react-native-async-storage/async-storage'

const computeCurrentStreak = (entries: { date: string }[]) => {
  const dates = new Set(entries.map((entry) => entry.date))
  const today = getLocalDateString(new Date())
  let streak = 0
  const cursor = new Date()

  if (!dates.has(today)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (dates.has(getLocalDateString(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export const StreakMilestone = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkMilestone = async () => {
      try {
        const entries = await loadEntries()
        const streak = computeCurrentStreak(entries)
        const seenDate = await AsyncStorage.getItem(MILESTONE_SEEN_KEY)
        const today = getLocalDateString(new Date())

        if (streak >= MILESTONE_DAYS && seenDate !== today && mounted) {
          setVisible(true)
          await AsyncStorage.setItem(MILESTONE_SEEN_KEY, today)
        }
      } catch (error) {
        captureException(error, 'StreakMilestone: checkMilestone')
      }
    }
    checkMilestone()
    return () => {
      mounted = false
    }
  }, [])

  const handleShare = async () => {
    try {
      await Share.share({
        title: t('streakMilestone.shareTitle'),
        message: t('streakMilestone.shareMessage', {
          days: MILESTONE_DAYS
        })
      })
    } catch (error) {
      captureException(error, 'StreakMilestone: handleShare')
    }
  }

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
            title={t('streakMilestone.title', { days: MILESTONE_DAYS })}
            textStyle={styles.title}
          />
          <Space height={vs(8)} />
          <Text
            h="h6"
            title={t('streakMilestone.body', { days: MILESTONE_DAYS })}
            oneColor={dimGray}
            textStyle={styles.body}
          />
          <Space height={vs(16)} />
          <ButtonWithIcon
            iconName="share-outline"
            title={t('streakMilestone.shareButton')}
            onPress={handleShare}
          />
          <Space height={vs(12)} />
          <ButtonWithIcon
            iconName="close-outline"
            title={t('streakMilestone.close')}
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
