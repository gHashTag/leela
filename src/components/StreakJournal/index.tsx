import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { captureException, dimGray, white } from '../../constants'

export interface JournalEntry {
  date: string
  text: string
}

const STORAGE_KEY = '@streakJournal'
const RECOVERY_KEY = '@streakRecoveryLastUsed'

export const getLocalDateString = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().split('T')[0]
}

const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const loadEntries = async (): Promise<JournalEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    captureException(error as Error, 'StreakJournal: loadEntries')
    return []
  }
}

const saveEntries = async (entries: JournalEntry[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch (error) {
    captureException(error as Error, 'StreakJournal: saveEntries')
  }
}

const getLastRecoveryDate = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(RECOVERY_KEY)
  } catch (error) {
    captureException(error as Error, 'StreakJournal: getLastRecoveryDate')
    return null
  }
}

const setLastRecoveryDate = async (date: string) => {
  try {
    await AsyncStorage.setItem(RECOVERY_KEY, date)
  } catch (error) {
    captureException(error as Error, 'StreakJournal: setLastRecoveryDate')
  }
}

export const computeStreak = (entries: JournalEntry[]) => {
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

export const canRecoverStreak = (
  entries: JournalEntry[],
  lastRecoveryDate: string | null
): boolean => {
  const dates = new Set(entries.map((entry) => entry.date))
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)
  const dayBeforeYesterdayDate = new Date()
  dayBeforeYesterdayDate.setDate(dayBeforeYesterdayDate.getDate() - 2)
  const dayBeforeYesterday = getLocalDateString(dayBeforeYesterdayDate)

  if (dates.has(yesterday)) return false
  if (!dates.has(dayBeforeYesterday)) return false

  if (lastRecoveryDate) {
    const today = parseLocalDate(getLocalDateString(new Date()))
    const lastRecovery = parseLocalDate(lastRecoveryDate)
    const diffDays = Math.floor(
      (today.getTime() - lastRecovery.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays < 7) return false
  }

  return true
}

export const StreakJournal = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [lastRecoveryDate, setLastRecoveryDate] = useState<string | null>(null)

  useEffect(() => {
    loadEntries().then(setEntries)
    getLastRecoveryDate().then(setLastRecoveryDate)
  }, [])

  const streak = useMemo(() => computeStreak(entries), [entries])
  const today = getLocalDateString(new Date())
  const todayEntry = entries.find((entry) => entry.date === today)
  const recoveryAvailable = useMemo(
    () => canRecoverStreak(entries, lastRecoveryDate),
    [entries, lastRecoveryDate]
  )

  const openModal = useCallback(() => {
    setDraft(todayEntry?.text || '')
    setModalVisible(true)
  }, [todayEntry])

  const handleSave = useCallback(async () => {
    const text = draft.trim()
    if (!text) return

    const next = todayEntry
      ? entries.map((entry) =>
          entry.date === today ? { ...entry, text } : entry
        )
      : [...entries, { date: today, text }]

    next.sort((a, b) => b.date.localeCompare(a.date))

    await saveEntries(next)
    setEntries(next)
    setDraft('')
    setModalVisible(false)
  }, [draft, entries, today, todayEntry])

  const handleRecover = useCallback(async () => {
    Alert.alert(
      t('streakJournal.recoveryTitle'),
      t('streakJournal.recoveryBody'),
      [
        {
          text: t('streakJournal.recoveryCancel'),
          style: 'cancel'
        },
        {
          text: t('streakJournal.recoveryConfirm'),
          onPress: async () => {
            const yesterdayDate = new Date()
            yesterdayDate.setDate(yesterdayDate.getDate() - 1)
            const yesterday = getLocalDateString(yesterdayDate)
            const recovered: JournalEntry = {
              date: yesterday,
              text: t('streakJournal.recoveredEntry')
            }
            const next = [...entries, recovered]
            next.sort((a, b) => b.date.localeCompare(a.date))
            await saveEntries(next)
            await setLastRecoveryDate(today)
            setEntries(next)
            setLastRecoveryDate(today)
          }
        }
      ],
      { cancelable: true }
    )
  }, [entries, t, today])

  const streakLabel = `${t('streakJournal.streakLabel')} ${streak} ${
    streak === 1 ? t('streakJournal.daySingular') : t('streakJournal.dayPlural')
  }`

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openModal}
        style={[styles.container, isDark && styles.containerDark]}
      >
        <View style={styles.row}>
          <Text h="h11" title="🔥" />
          <Space width={s(8)} />
          <Text
            h="h11"
            title={t('streakJournal.title')}
            oneColor="#FFB74D"
            textStyle={styles.title}
          />
        </View>
        <Space height={vs(4)} />
        <Text h="h8" title={streakLabel} oneColor="#FFFFFF" />
        <Space height={vs(4)} />
        <Text
          h="h10"
          title={
            todayEntry
              ? t('streakJournal.todayReflection')
              : t('streakJournal.reflectionPrompt')
          }
          oneColor="#E0E0E0"
        />
        {recoveryAvailable && (
          <>
            <Space height={vs(8)} />
            <ButtonWithIcon
              iconName="refresh-outline"
              h="h10"
              title={t('streakJournal.recoverStreak')}
              onPress={handleRecover}
            />
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.closeRow}
            >
              <Text h="h5" title="✕" />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                h="h2"
                textStyle={styles.modalTitle}
                title={t('streakJournal.title')}
              />
              <Space height={vs(8)} />
              <Text h="h8" title={streakLabel} oneColor={dimGray} />
              <Space height={vs(12)} />
              <TextInput
                style={styles.input}
                multiline
                placeholder={t('streakJournal.placeholder')}
                placeholderTextColor={dimGray}
                value={draft}
                onChangeText={setDraft}
              />
              <Space height={vs(12)} />
              <ButtonWithIcon
                iconName="save-outline"
                title={t('streakJournal.save')}
                onPress={handleSave}
              />
              <Space height={vs(16)} />
              {entries.length === 0 ? (
                <Text
                  h="h7"
                  title={t('streakJournal.noEntries')}
                  textStyle={styles.empty}
                />
              ) : (
                entries.map((entry) => (
                  <View key={entry.date} style={styles.entryRow}>
                    <Text h="h10" title={entry.date} oneColor={dimGray} />
                    <Space height={vs(4)} />
                    <Text h="h7" title={entry.text} />
                    <Space height={vs(8)} />
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(255, 87, 34, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.5)'
  },
  containerDark: {
    backgroundColor: 'rgba(255, 87, 34, 0.28)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: white,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    paddingHorizontal: s(20),
    paddingTop: s(16),
    paddingBottom: s(34),
    maxHeight: '88%'
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding: s(4)
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#1c1c1c',
    textAlign: 'center'
  },
  input: {
    width: '100%',
    minHeight: vs(100),
    borderWidth: 1,
    borderColor: dimGray,
    borderRadius: s(10),
    padding: s(10),
    color: '#1c1c1c',
    textAlignVertical: 'top'
  },
  entryRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingVertical: s(8)
  },
  empty: {
    textAlign: 'center',
    color: dimGray
  }
})
