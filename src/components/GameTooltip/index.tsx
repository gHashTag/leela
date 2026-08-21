import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { brightTurquoise, captureException, dimGray } from '../../constants'

/**
 * One rule at a time, above the board.
 *
 * The onboarding explains the whole game before anyone has rolled, which is
 * the wrong moment to learn that only a six opens the board. This says the
 * thing that matters right now, and remembers being dismissed.
 *
 * No colour is pinned on the title: it is drawn on a pale mint card, and when
 * it was hardcoded to `white` the heading was invisible - present, readable by
 * a screen reader, and gone to everyone else.
 */

const SEEN_KEY = '@gameTipsSeen'
const HIDDEN_KEY = '@gameTipsHidden'

export type GameTipId = 'six' | 'snake' | 'arrow' | 'report'

interface GameTooltipT {
  /** Which rule to show. Nothing renders if it has been seen or tips are off. */
  tip: GameTipId
  onLearnMore?: () => void
}

export const GameTooltip = memo(({ tip, onLearnMore }: GameTooltipT) => {
  const { t } = useTranslation()
  const isDark = useColorScheme() === 'dark'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([
      AsyncStorage.getItem(HIDDEN_KEY),
      AsyncStorage.getItem(SEEN_KEY)
    ])
      .then(([hidden, seenRaw]) => {
        if (!mounted) return
        if (hidden === 'true') return
        const seen: string[] = seenRaw ? JSON.parse(seenRaw) : []
        setVisible(!seen.includes(tip))
      })
      .catch((error) => captureException(error, 'GameTooltip:load'))
    return () => {
      mounted = false
    }
  }, [tip])

  const dismiss = useCallback(async () => {
    setVisible(false)
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY)
      const seen: string[] = raw ? JSON.parse(raw) : []
      if (!seen.includes(tip)) {
        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen, tip]))
      }
    } catch (error) {
      captureException(error, 'GameTooltip:dismiss')
    }
  }, [tip])

  const hideAll = useCallback(async () => {
    setVisible(false)
    try {
      await AsyncStorage.setItem(HIDDEN_KEY, 'true')
    } catch (error) {
      captureException(error, 'GameTooltip:hideAll')
    }
  }, [])

  if (!visible) return null

  return (
    <View
      style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}
      testID="game-tooltip"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${t(`gameTips.${tip}.title`)}, ${t(`gameTips.${tip}.body`)}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <View
          style={[styles.bulb, isDark ? styles.bulbDark : styles.bulbLight]}
        >
          <Text h="h4" title="💡" />
        </View>
        <Space width={s(12)} />
        <View style={styles.textWrap}>
          <Text
            h="h6"
            title={t(`gameTips.${tip}.title`)}
            textStyle={styles.title}
          />
          <Space height={vs(4)} />
          <Text
            h="h5"
            title={t(`gameTips.${tip}.body`)}
            oneColor={dimGray}
            textStyle={styles.body}
          />
        </View>
      </View>

      <Space height={vs(10)} />

      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          style={[styles.gotIt, isDark ? styles.gotItDark : styles.gotItLight]}
          accessibilityRole="button"
          accessibilityLabel={t('gameTips.gotIt')}
        >
          <Text h="h6" title={t('gameTips.gotIt')} oneColor={brightTurquoise} />
        </Pressable>

        {onLearnMore && (
          <Pressable
            onPress={onLearnMore}
            accessibilityRole="button"
            accessibilityLabel={t('gameTips.learnMore')}
          >
            <Text h="h6" title={t('gameTips.learnMore')} oneColor={dimGray} />
          </Pressable>
        )}

        <Pressable
          onPress={hideAll}
          accessibilityRole="button"
          accessibilityLabel={t('gameTips.hideAll')}
        >
          <Text h="h6" title={t('gameTips.hideAll')} oneColor={dimGray} />
        </Pressable>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  // Solid, not tinted. At 10% opacity the board's crystals and feathers showed
  // straight through the notice and tangled with its own text. These are the
  // same mint, flattened against the scheme's background so nothing bleeds.
  card: {
    marginHorizontal: s(14),
    marginTop: vs(8),
    padding: s(14),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: '#7FE3CD',
    // Lifts the card off the artwork so it reads as a notice, not a wash.
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  cardLight: {
    backgroundColor: '#EAFBF7'
  },
  cardDark: {
    backgroundColor: '#16302B',
    borderColor: '#2F6B5E'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bulb: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center'
  },
  bulbLight: {
    backgroundColor: '#CFF3EA'
  },
  bulbDark: {
    backgroundColor: '#224A42'
  },
  textWrap: {
    flex: 1
  },
  // No colour: it comes from the theme. Pinned to white it vanished here.
  title: {
    fontWeight: '600'
  },
  body: {
    lineHeight: vs(18)
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  gotIt: {
    paddingVertical: vs(4),
    paddingHorizontal: s(12),
    borderRadius: s(14)
  },
  gotItLight: {
    backgroundColor: '#CFF3EA'
  },
  gotItDark: {
    backgroundColor: '#224A42'
  }
})
