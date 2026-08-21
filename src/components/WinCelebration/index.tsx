import React, { useEffect, useMemo, useRef } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { Animated, Easing, StyleSheet, Vibration, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Text } from '../../components'
import { brightTurquoise } from '../../constants'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../store'
import { announceForAccessibility } from '../../utils/accessibilityAnnouncements'
import { useReducedMotion } from '../../utils/useReducedMotion'

const RADIUS = s(120)
const PARTICLE_COUNT = 12
const DURATION = 1600

export const WinCelebration = observer(() => {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const online = DiceStore.online
  const endGame = useMemo(
    () =>
      online ? OnlinePlayer.store.finish : !DiceStore.finishArr.includes(true),
    [online]
  )

  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current
  const prevEndGame = useRef(false)

  useEffect(() => {
    if (!prevEndGame.current && endGame) {
      Vibration.vibrate([0, 40, 60, 40])
      if (reducedMotion) {
        progress.setValue(1)
        announceForAccessibility(t('accessibilityAnnouncements.win'))
      } else {
        progress.setValue(0)
        Animated.timing(progress, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }).start(() => {
          announceForAccessibility(t('accessibilityAnnouncements.win'))
        })
      }
    }
    prevEndGame.current = endGame
  }, [endGame, progress, reducedMotion, t])

  if (!endGame) return null

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={t('accessibilityAnnouncements.win')}
      accessibilityLiveRegion="assertive"
    >
      <Text h="h1" title={t('winCelebration.title')} textStyle={styles.title} />
      {reducedMotion
        ? null
        : Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
            const angle = (index / PARTICLE_COUNT) * Math.PI * 2
            const tx = Math.cos(angle) * RADIUS
            const ty = Math.sin(angle) * RADIUS * 0.6

            const translateX = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, tx]
            })
            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, ty]
            })
            const opacity = progress.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [1, 1, 0]
            })
            const scale = progress.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, 1, 0.6]
            })
            const rotate = progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${index % 2 === 0 ? 360 : -360}deg`]
            })

            return (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  {
                    transform: [
                      { translateX },
                      { translateY },
                      { scale },
                      { rotate }
                    ],
                    opacity
                  }
                ]}
              />
            )
          })}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: vs(90),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  title: {
    color: brightTurquoise,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  particle: {
    position: 'absolute',
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: brightTurquoise
  }
})
