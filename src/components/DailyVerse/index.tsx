import React, { memo, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'
import ViewShot from 'react-native-view-shot'
import { Space, Text } from '../../components'
import { captureException } from '../../constants'

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
  const [isSharing, setIsSharing] = useState(false)
  const cardRef = useRef<ViewShot>(null)

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

  const handleShareImage = async () => {
    if (!cardRef.current || isSharing) return
    setIsSharing(true)
    try {
      const uri = await cardRef.current.capture()
      if (!uri) return
      await Share.share({
        title: t('dailyVerse.shareTitle'),
        message: `${t('dailyVerse.shareMessage')}\n${verse?.quote || ''}`,
        url: uri
      })
    } catch (error) {
      if ((error as Error)?.message?.includes('cancel')) return
      captureException(error, 'DailyVerse: shareImage')
      Alert.alert(
        t('error') || 'Error',
        t('dailyVerse.shareError') || 'Could not share the verse image.'
      )
    } finally {
      setIsSharing(false)
    }
  }

  if (!verse) return null

  return (
    <View>
      <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpanded((p) => !p)}
          style={[styles.container, isDark && styles.containerDark]}
          testID="daily-verse"
          accessibilityRole="button"
          accessibilityLabel={t('dailyVerse.accessibilityLabel')}
          accessibilityHint={t('dailyVerse.accessibilityHint')}
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
      </ViewShot>
      <View style={styles.shareRow}>
        {isSharing ? (
          <ActivityIndicator size="small" color="#B39DDB" />
        ) : (
          <TouchableOpacity
            onPress={handleShareImage}
            style={styles.shareButton}
            accessibilityRole="button"
            accessibilityLabel={t('dailyVerse.shareAccessibilityLabel')}
          >
            <Text
              h="h11"
              title={t('dailyVerse.shareButton')}
              oneColor="#B39DDB"
              textStyle={styles.shareText}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(2),
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
  },
  shareRow: {
    alignItems: 'flex-end',
    marginHorizontal: s(16),
    marginBottom: vs(6),
    minHeight: vs(24)
  },
  shareButton: {
    paddingVertical: vs(4),
    paddingHorizontal: s(8)
  },
  shareText: {
    textDecorationLine: 'underline'
  }
})
