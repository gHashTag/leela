import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonSimple, Space, Text } from '../'
import { blackOpacity, secondary, white } from '../../constants'

const { width } = Dimensions.get('window')

const STEPS = ['intro', 'roll', 'report', 'finish'] as const

type Step = (typeof STEPS)[number]

const STORAGE_KEY = '@howToPlaySeen'

export function TutorialOverlay() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [stepIndex, setStepIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY)
        if (seen !== 'true') {
          setVisible(true)
        }
      } catch (error) {
        // Storage failure is not user-blocking.
      }
    }
    check()
  }, [])

  if (!visible) {
    return null
  }

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  const onNext = () => {
    if (isLast) {
      AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {
        // ignore persistence failure
      })
      setVisible(false)
    } else {
      setStepIndex((idx) => idx + 1)
    }
  }

  const onSkip = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <View style={styles.container} testID="tutorial-overlay">
      <Pressable style={styles.backdrop} onPress={onSkip} />
      <View style={styles.card}>
        <Text
          h="h2"
          title={t(`tutorial.${step}Title`)}
          textStyle={styles.title}
        />
        <Space height={vs(16)} />
        <Text
          h="h5"
          title={t(`tutorial.${step}Body`)}
          textStyle={styles.body}
        />
        <Space height={vs(24)} />
        <View style={styles.dots}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === stepIndex && styles.activeDot]}
            />
          ))}
        </View>
        <Space height={vs(24)} />
        <ButtonSimple
          h="h3"
          title={isLast ? t('tutorial.done') : t('tutorial.next')}
          onPress={onNext}
        />
        <Space height={vs(12)} />
        <ButtonSimple
          h="h5"
          title={t('tutorial.skip')}
          onPress={onSkip}
          viewStyle={styles.skipButton}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: blackOpacity
  },
  card: {
    width: width * 0.85,
    backgroundColor: white,
    borderRadius: s(20),
    padding: s(24),
    alignItems: 'center',
    zIndex: 1
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  body: {
    textAlign: 'center',
    lineHeight: vs(22)
  },
  dots: {
    flexDirection: 'row'
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: '#888',
    marginHorizontal: s(4)
  },
  activeDot: {
    backgroundColor: secondary,
    width: s(20)
  },
  skipButton: {
    opacity: 0.7
  }
})
