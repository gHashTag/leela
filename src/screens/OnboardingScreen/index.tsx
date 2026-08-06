import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import { ms, s, vs } from 'react-native-size-matters'

import {
  Background,
  Button,
  CenterView,
  IconLeela,
  Space,
  Text
} from '../../components'
import { black, secondary, white } from '../../constants'
import { RootStackParamList } from '../../types/types'

const { width } = Dimensions.get('window')

const STEPS = ['step1', 'step2', 'step3'] as const

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ONBOARDING_SCREEN'
>

type OnboardingScreenT = {
  navigation: navigation
}

export const OnboardingScreen: React.FC<OnboardingScreenT> = ({
  navigation
}) => {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboardingComplete', 'true')
    } catch (error) {
      // Storage failure is not user-blocking; continue to auth.
    }
    navigation.replace('HELLO')
  }

  const onNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      completeOnboarding()
    }
  }

  const key = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Background enableTopInsets enableBottomInsets>
      <CenterView>
        <IconLeela />
        <Space height={vs(40)} />
        <View style={styles.card}>
          <Text
            h="h1"
            textStyle={styles.title}
            title={t(`onboarding.${key}Title`)}
          />
          <Space height={vs(16)} />
          <Text
            h="h4"
            textStyle={styles.body}
            title={t(`onboarding.${key}Body`)}
          />
        </View>
        <Space height={vs(40)} />
        <View style={styles.dots}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === step && styles.activeDot
              ]}
            />
          ))}
        </View>
        <Space height={vs(40)} />
        <Button
          title={isLast ? t('onboarding.start') : t('onboarding.next')}
          onPress={onNext}
        />
        <Space height={vs(16)} />
        <Pressable onPress={completeOnboarding}>
          <Text h="h5" textStyle={styles.skip} title={t('actions.skip') || 'Skip'} />
        </Pressable>
      </CenterView>
    </Background>
  )
}

const styles = StyleSheet.create({
  card: {
    width: width * 0.85,
    padding: s(20),
    borderRadius: ms(20, 0.6),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center'
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: white
  },
  body: {
    textAlign: 'center',
    lineHeight: vs(24),
    color: white
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
  skip: {
    color: '#aaa',
    textDecorationLine: 'underline'
  }
})
