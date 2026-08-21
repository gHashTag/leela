import React, { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { RADIUS, SPACE, paletteFor } from '../../theme'
import {
  formatCountdown,
  getTimeLeft,
  getTrialDeadline,
  TimeLeftT
} from '../../utils/trialTimer'

const UPDATE_INTERVAL = 1000

export const TrialTimer = () => {
  const { t } = useTranslation()
  const [deadline, setDeadline] = useState<number | null>(null)
  const [left, setLeft] = useState<TimeLeftT | null>(null)

  useEffect(() => {
    let mounted = true
    getTrialDeadline().then((d) => {
      if (mounted) {
        setDeadline(d)
        setLeft(getTimeLeft(d))
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => {
      setLeft(getTimeLeft(deadline))
    }, UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [deadline])

  /*
   * The offer, in the app's own accent.
   *
   * It was `fuchsia` — a flat magenta with no counterpart in the other scheme,
   * beside a board whose accent is green. A countdown does not need a colour
   * nobody else uses to be noticed; it needs to be legible, and to belong.
   *
   * **Above the early return, and that is not a style choice.** This stood
   * below it and the app crashed: while the deadline was still being read the
   * component returned `null` and ran no hook here, and the moment the read
   * came back it ran one — *rendered more hooks than during the previous
   * render*. A hook may not sit behind a condition, and an early return is a
   * condition.
   */
  const palette = paletteFor(useColorScheme() === 'dark')

  if (!left) return null

  return (
    <View style={[styles.container, { backgroundColor: palette.accent }]}>
      <Text h="h5" title="🔥" />
      <Space width={s(6)} />
      <View>
        <Text
          h="h7"
          title={t('trialTimer.title')}
          textStyle={styles.title}
          oneColor={palette.onAccent}
        />
        <Text
          h="h4"
          title={formatCountdown(left, t)}
          oneColor={palette.onAccent}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: s(RADIUS),
    paddingHorizontal: s(SPACE.md),
    paddingVertical: vs(SPACE.sm),
    marginHorizontal: s(SPACE.md),
    marginBottom: vs(SPACE.sm)
  },
  title: {
    opacity: 0.9
  }
})
