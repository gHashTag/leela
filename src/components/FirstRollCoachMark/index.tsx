import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Button, Space, Text } from '../../components'
import { black, primary, white } from '../../constants'
import { DiceStore, OnlinePlayer } from '../../store'
import { triggerHaptic } from '../../utils/haptics'

const STORAGE_KEY = '@leela:firstRollCoachShown'
const { width: SCREEN_W } = Dimensions.get('window')

interface FirstRollCoachMarkT {
  online?: boolean
}

export const FirstRollCoachMark: React.FC<FirstRollCoachMarkT> = ({
  online = false
}) => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const endGame = online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const shown = await AsyncStorage.getItem(STORAGE_KEY)
        if (mounted && shown !== 'true' && !endGame) {
          triggerHaptic('impactLight')
          setVisible(true)
        }
      } catch {
        // Storage failure is non-blocking.
      }
    }
    check()
    return () => {
      mounted = false
    }
  }, [endGame])

  const dismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Storage failure is non-blocking.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable style={styles.backdrop} pointerEvents="auto" onPress={dismiss} />
      <View style={styles.card} pointerEvents="auto">
        <Text
          h="h3"
          title={t('gameCoach.title')}
          oneColor={white}
          textStyle={styles.title}
        />
        <Space height={vs(8)} />
        <Text
          h="h5"
          title={t('gameCoach.message')}
          oneColor="#E0E0E0"
          textStyle={styles.message}
        />
        <Space height={vs(16)} />
        <Button
          title={t('gameCoach.gotIt')}
          onPress={dismiss}
          testID="first-roll-coach-got-it"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: black,
    opacity: 0.35
  },
  card: {
    width: SCREEN_W - s(32),
    backgroundColor: primary,
    borderRadius: s(16),
    padding: s(20),
    marginBottom: vs(140),
    alignItems: 'center'
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center'
  },
  message: {
    textAlign: 'center'
  }
})
