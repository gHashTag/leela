import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
  useColorScheme
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
import { RADIUS, SPACE, TOUCH, TYPE, paletteFor } from '../../theme'
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

/**
 * How many screens stand before the board.
 *
 * Exported so the test can be about the rule rather than about today's number:
 * it asserted "Step 1 of 9" and turned a deliberate shortening into a failure.
 */
export const STEP_COUNT = STEPS.length

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
  // One palette, from `src/theme`, following the phone's scheme.
  const palette = paletteFor(useColorScheme() === 'dark')
  const styles = React.useMemo(() => stylesFor(palette), [palette])

  const [step, setStep] = useState(0)

  /*
   * The nine steps greet a player once. `completeOnboarding` below has always
   * written `@onboardingComplete`, but nothing ever read it back, so the whole
   * sequence replayed on every launch. Read the flag before showing step 1:
   * a returning player goes straight to the board, the way the flag intended.
   * A storage failure falls through to showing the steps - the harmless side.
   */
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem('@onboardingComplete')
      .then((seen) => {
        if (cancelled) {
          return
        }
        if (seen === 'true') {
          navigation.replace('MAIN', { screen: 'TAB_BOTTOM_0' })
        } else {
          setReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [navigation])

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboardingComplete', 'true')
    } catch (error) {
      // Storage failure is not user-blocking; continue to the board.
    }
    /*
     * Straight into the game.
     *
     * This went to `HELLO`, which offered Sign in, Sign up, Select players and
     * Play - so the last thing a player met after nine screens explaining the
     * board was a form. The board is what they came for, and nothing about
     * throwing a die, landing on a plan and writing about it needs an account.
     *
     * The auth screens are still registered and still reachable: the profile
     * links to them, and signing in is what carries a path between devices. It
     * is an offer now rather than a door.
     */
    navigation.replace('MAIN', { screen: 'TAB_BOTTOM_0' })
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

  if (!ready) {
    // Just the backdrop while the flag is read - no step card, no flash.
    return (
      <Background enableTopInsets enableBottomInsets>
        {null}
      </Background>
    )
  }

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
          title={t('onboarding.stepCounter', {
            current: step + 1,
            total: STEPS.length
          })}
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
              style={[styles.dot, index === step && styles.activeDot]}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === step }}
              accessibilityLabel={t('onboarding.stepLabel', {
                step: index + 1
              })}
            />
          ))}
        </View>
        <Space height={vs(40)} />
        <Button
          title={isLast ? t('onboarding.start') : t('onboarding.next')}
          onPress={onNext}
          testID="onboarding-next-button"
        />
        <Space height={vs(SPACE.lg)} />
        <ButtonLink
          title={t('actions.skip') || 'Skip'}
          onPress={completeOnboarding}
          viewStyle={styles.skip}
          textStyle={styles.skipText}
          testID="onboarding-skip-button"
        />
      </CenterView>
    </Background>
  )
}

/**
 * The sheet, as a function of the palette.
 *
 * The dots were `#888` and `secondary` (#ff06f4) and the step counter `#aaa` —
 * two literals and a magenta, none of which changes with the scheme. On the
 * screen that opens the app, beside a board whose accent is green.
 */
const stylesFor = (palette: ReturnType<typeof paletteFor>) =>
  StyleSheet.create({
    card: {
      width: width * 0.85,
      padding: s(SPACE.md),
      borderRadius: ms(RADIUS, 0.6),
      // The raised surface, which exists in both schemes. The literal it replaces
      // was white at 8% - invisible on paper, which is the ground this screen
      // actually stands on.
      backgroundColor: palette.raised,
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
      backgroundColor: palette.rule,
      marginHorizontal: s(SPACE.xs / 2)
    },
    activeDot: {
      backgroundColor: palette.accent,
      width: s(SPACE.md)
    },
    stepCounter: {
      color: palette.hint
    },
    /*
     * The way out, and it has to be findable.
     *
     * It was drawn in the accent - the colour of *Next*, the thing you are meant
     * to do - low on the page and at link size, over a watercolour dreamcatcher.
     * Nobody could see it.
     *
     * Higher, larger, and in `escape`: a role of its own, so this is the way past
     * something rather than another way on. `paddingVertical` gives the tap a
     * target the whole height of a control rather than the height of one word.
     */
    skip: {
      alignSelf: 'center',
      marginBottom: SPACE.lg,
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.lg,
      minHeight: TOUCH,
      justifyContent: 'center'
    },
    skipText: {
      color: palette.escape,
      fontSize: ms(TYPE.title, 0.6),
      fontWeight: 'bold'
    }
  })
