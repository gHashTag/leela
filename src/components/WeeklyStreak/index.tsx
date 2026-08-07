import React, { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { brightTurquoise, dimGray } from '../../constants'
import { loadEntries } from '../StreakJournal'
import { getWeekSummary } from '../../utils/weeklyStreak'

export const WeeklyStreak = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [entries, setEntries] = useState([])

  useEffect(() => {
    loadEntries().then(setEntries)
  }, [])

  const { streak, week } = useMemo(() => getWeekSummary(entries, t), [entries, t])
  const label = `${t('weeklyStreak.title')} ${streak} ${
    streak === 1 ? t('weeklyStreak.daySingular') : t('weeklyStreak.dayPlural')
  }`

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="🔥" />
        <Space width={s(8)} />
        <Text h="h11" title={label} oneColor="#FFB74D" textStyle={styles.title} />
      </View>
      <Space height={vs(8)} />
      <View style={styles.weekRow}>
        {week.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            <View
              testID="day-dot"
              style={[
                styles.dayDot,
                day.active && styles.dayDotActive
              ]}
            />
            <Space height={vs(4)} />
            <Text h="h11" title={day.label} oneColor={dimGray} />
          </View>
        ))}
      </View>
    </View>
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
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayCell: {
    alignItems: 'center'
  },
  dayDot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: dimGray
  },
  dayDotActive: {
    backgroundColor: brightTurquoise
  }
})
