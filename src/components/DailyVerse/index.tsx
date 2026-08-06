import React, { memo, useMemo, useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'
import { Space, Text } from '../../components'

interface Verse {
  quote: string
  source: string
  reflection: string
}

export const DailyVerse = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const [expanded, setExpanded] = useState(false)

  const verses = useMemo(
    () =>
      (t('dailyVerse.verses', { returnObjects: true }) || []) as Verse[],
    [t]
  )

  const verse = useMemo(() => {
    if (!verses.length) return null
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    )
    return verses[dayOfYear % verses.length]
  }, [verses])

  if (!verse) return null

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded((p) => !p)}
      style={[styles.container, isDark && styles.containerDark]}
      testID="daily-verse"
    >
      <Text
        h="h11"
        title={t('dailyVerse.title')}
        oneColor="#B39DDB"
        textStyle={styles.title}
      />
      <Space height={vs(4)} />
      <Text
        h="h8"
        title={`“${verse.quote}”`}
        oneColor="#FFFFFF"
        textStyle={styles.quote}
      />
      <Space height={vs(4)} />
      <Text h="h10" title={verse.source} oneColor="#D1C4E9" />
      {expanded && (
        <>
          <Space height={vs(8)} />
          <View style={styles.divider} />
          <Space height={vs(6)} />
          <Text
            h="h10"
            title={`${t('dailyVerse.reflection')}: ${verse.reflection}`}
            oneColor="#E1BEE7"
            textStyle={styles.reflection}
          />
        </>
      )}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(81, 45, 168, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.6)'
  },
  containerDark: {
    backgroundColor: 'rgba(81, 45, 168, 0.32)'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  quote: {
    lineHeight: s(20)
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  reflection: {
    fontStyle: 'italic',
    lineHeight: s(18)
  }
})
