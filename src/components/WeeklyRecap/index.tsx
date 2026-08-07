import React, { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { brightTurquoise, dimGray } from '../../constants'
import { DiceStore, OfflinePlayers, OnlinePlayer, PostStore } from '../../store'
import { loadEntries, computeStreak } from '../StreakJournal'

const getWeekBounds = (referenceDate = new Date()) => {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return { start, end }
}

const countRollsThisWeek = (referenceDate = new Date()): number => {
  const history = DiceStore.online
    ? OnlinePlayer.store.history
    : OfflinePlayers.store.histories[DiceStore.players - 1] || []

  const { start, end } = getWeekBounds(referenceDate)
  return history.filter((item) => {
    const time = item.createDate
    return time >= start.getTime() && time < end.getTime()
  }).length
}

const countReportsThisWeek = (referenceDate = new Date()): number => {
  const { start, end } = getWeekBounds(referenceDate)
  return PostStore.store.ownPosts.filter((post) => {
    const time = post.createTime
    return time >= start.getTime() && time < end.getTime()
  }).length
}

export const WeeklyRecap = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [entries, setEntries] = useState([])

  useEffect(() => {
    loadEntries().then(setEntries)
  }, [])

  const rolls = useMemo(() => countRollsThisWeek(), [])
  const reports = useMemo(() => countReportsThisWeek(), [PostStore.store.ownPosts])
  const streak = useMemo(() => computeStreak(entries), [entries])

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="📊" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('weeklyRecap.title')}
          oneColor="#FFB74D"
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(12)} />
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text h="h3" title={`${rolls}`} oneColor={brightTurquoise} textStyle={styles.statValue} />
          <Space height={vs(2)} />
          <Text h="h11" title={t('weeklyRecap.rolls')} oneColor={dimGray} />
        </View>
        <View style={styles.stat}>
          <Text h="h3" title={`${reports}`} oneColor={brightTurquoise} textStyle={styles.statValue} />
          <Space height={vs(2)} />
          <Text h="h11" title={t('weeklyRecap.reports')} oneColor={dimGray} />
        </View>
        <View style={styles.stat}>
          <Text h="h3" title={`${streak}`} oneColor={brightTurquoise} textStyle={styles.statValue} />
          <Space height={vs(2)} />
          <Text h="h11" title={t('weeklyRecap.streak')} oneColor={dimGray} />
        </View>
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
    backgroundColor: 'rgba(80, 227, 194, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.35)'
  },
  containerDark: {
    backgroundColor: 'rgba(80, 227, 194, 0.18)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  stat: {
    alignItems: 'center',
    flex: 1
  },
  statValue: {
    fontWeight: 'bold'
  }
})
