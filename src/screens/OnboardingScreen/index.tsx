import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View
} from 'react-native'
import { ms, s, vs } from 'react-native-size-matters'

import {
  Background,
  Button,
  ButtonLink,
  CenterView,
  IconLeela,
  Space,
  Text
} from '../../components'
import { secondary } from '../../constants'
import { RootStackParamList } from '../../types/types'
import { triggerHaptic } from '../../utils/haptics'

const { width } = Dimensions.get('window')

const STEPS = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
  'step8',
  'step9'
] as const

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

  const onPrevious = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleCardTap = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent
    const threshold = width * 0.35
    if (locationX < threshold) {
      onPrevious()
    } else {
      onNext()
    }
  }

  useEffect(() => {
    triggerHaptic('impactLight')
  }, [step])

  const key = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Background enableTopInsets enableBottomInsets>
      <CenterView>
        <IconLeela />
        <Space height={vs(40)} />
        <Pressable
          onPress={handleCardTap}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.tapToAdvance')}
          accessibilityHint={t('onboarding.tapLeftRightHint')}
        >
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
        </Pressable>
        <Space height={vs(16)} />
        <Text
          h="h6"
          textStyle={styles.stepCounter}
          title={t('onboarding.stepCounter', { current: step + 1, total: STEPS.length })}
          testID="onboarding-step-counter"
        />
        <Space height={vs(24)} />
        <View
          style={styles.dots}
          accessibilityRole="tablist"
          accessibilityLabel={t('onboarding.progressLabel')}
        >
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === step && styles.activeDot
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === step }}
              accessibilityLabel={t('onboarding.stepLabel', { step: index + 1 })}
            />
          ))}
        </View>
        <Space height={vs(40)} />
        <Button
          title={isLast ? t('onboarding.start') : t('onboarding.next')}
          onPress={onNext}
          testID="onboarding-next-button"
        />
        <Space height={vs(16)} />
        <ButtonLink
          title={t('actions.skip') || 'Skip'}
          onPress={completeOnboarding}
          viewStyle={styles.skip}
          testID="onboarding-skip-button"
        />
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
  // No `color` here on purpose: Text resolves it from the theme, and textStyle
  // is merged after that, so naming a colour pins the screen to one scheme.
  // It was `white`, over a light Background - the copy rendered invisible.
  title: {
    fontWeight: 'bold',
    textAlign: 'center'
  },
  body: {
    textAlign: 'center',
    lineHeight: vs(24)
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
  stepCounter: {
    color: '#aaa'
  },
  skip: {
    alignSelf: 'center'
  }
})
