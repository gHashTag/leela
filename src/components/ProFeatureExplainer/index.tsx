import React, { memo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { FREE_THROWS } from '../../pricing'
import { RADIUS, SPACE, TOUCH, useTheme, type Palette } from '../../theme'

interface ProFeatureExplainerT {
  visible: boolean
  onClose: () => void
}

/**
 * What a subscription actually buys, and nothing else.
 *
 * The five keys this replaces were written for the app as it used to be, and
 * two of them had become false: `community` promised a feed with reactions and
 * replies, which no longer has any way in - `Navigation.tsx` renders
 * `tabBar={() => null}` and nothing navigates to that screen - and
 * `offlineCache` promised the last five answers kept for reading offline, which
 * appears nowhere in the source at all. `dailyVerse` is real but free, so
 * selling it here was the same kind of mistake pointing the other way.
 *
 * Three claims, each checked against the code: `toll.ts` stops the die after
 * the free throws, `BoardScreen` hands the entitlement to the board, and no
 * advertising SDK is linked in the Podfile.
 *
 * Fewer promises than before. A paywall that overstates is not more persuasive
 * once the player is inside.
 */
const FEATURE_KEYS = ['throws', 'guide', 'noAds'] as const

export const ProFeatureExplainer = memo(
  ({ visible, onClose }: ProFeatureExplainerT) => {
    const { t } = useTranslation()
    // Above everything that could return early. A hook after a condition is how
    // `TrialTimer` came to crash the whole screen with "rendered more hooks
    // than during the previous render".
    const palette = useTheme()
    const styles = React.useMemo(() => stylesFor(palette), [palette])
    const [activeIndex, setActiveIndex] = useState(0)

    const featureKey = FEATURE_KEYS[activeIndex]

    const handleNext = () => {
      if (activeIndex < FEATURE_KEYS.length - 1) {
        setActiveIndex(activeIndex + 1)
      } else {
        setActiveIndex(0)
        onClose()
      }
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Pressable onPress={onClose} style={styles.closeRow}>
              <Text h="h5" title="✕" />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                h="h2"
                textStyle={styles.title}
                title={t('proFeatureExplainer.title')}
              />
              <Space height={s(16)} />
              <View style={styles.pager}>
                {FEATURE_KEYS.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      idx === activeIndex && styles.activeDot
                    ]}
                  />
                ))}
              </View>
              <Space height={s(16)} />
              <Text
                h="h3"
                textStyle={styles.featureTitle}
                title={t(`proFeatureExplainer.features.${featureKey}.title`)}
              />
              <Space height={s(12)} />
              <Text
                h="h5"
                textStyle={styles.featureBody}
                // The allowance travels with the sentence rather than inside
                // it, so a change to `FREE_THROWS` reaches all ten languages.
                title={t(`proFeatureExplainer.features.${featureKey}.body`, {
                  count: FREE_THROWS
                })}
              />
            </ScrollView>
            <Space height={s(16)} />
            <Pressable onPress={handleNext} style={styles.nextButton}>
              <Text
                h="h4"
                textStyle={styles.nextText}
                title={
                  activeIndex < FEATURE_KEYS.length - 1
                    ? t('proFeatureExplainer.next')
                    : t('proFeatureExplainer.gotIt')
                }
              />
            </Pressable>
            <Space height={s(10)} />
            <Text
              h="h5"
              textStyle={styles.dismiss}
              title={t('proFeatureExplainer.dismiss')}
              onPress={onClose}
            />
          </View>
        </View>
      </Modal>
    )
  }
)

/**
 * The sheet, as a function of the palette.
 *
 * It was white paper with a magenta button in both schemes: on a dark phone
 * this modal opened as a rectangle of daylight over a black board. The five
 * colours it spelled out - white, black, the app's magenta and two greys
 * written as `#CCCCCC` and `#888` - are roles in `src/theme` now, and the
 * spacing is the shared ladder rather than six numbers chosen here.
 */
const stylesFor = (palette: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      // The scrim stays black in both schemes: it is shadow, not surface.
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end'
    },
    card: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      paddingHorizontal: SPACE.md,
      paddingTop: SPACE.md,
      // Clear of the home indicator.
      paddingBottom: SPACE.xl,
      maxHeight: '88%'
    },
    closeRow: {
      alignSelf: 'flex-end',
      // A tap target rather than a glyph: `padding: 4` around a "✕" is an
      // eight-point button, and Apple's floor is forty-four.
      minWidth: TOUCH,
      minHeight: TOUCH,
      alignItems: 'flex-end',
      justifyContent: 'center'
    },
    title: {
      fontWeight: 'bold',
      color: palette.text,
      textAlign: 'center'
    },
    pager: {
      flexDirection: 'row',
      justifyContent: 'center'
    },
    dot: {
      width: s(8),
      height: s(8),
      borderRadius: s(4),
      backgroundColor: palette.rule,
      marginHorizontal: SPACE.xs / 2
    },
    activeDot: {
      backgroundColor: palette.accent
    },
    featureTitle: {
      color: palette.text,
      textAlign: 'center',
      fontWeight: 'bold',
      // The same magenta glow `Text` puts behind every size it does not list as
      // shadowless, which on a heading this large reads as a printing fault.
      textShadowColor: 'transparent',
      textShadowRadius: 0
    },
    featureBody: {
      color: palette.text,
      lineHeight: s(22),
      textAlign: 'center'
    },
    nextButton: {
      backgroundColor: palette.accent,
      minHeight: TOUCH,
      justifyContent: 'center',
      borderRadius: RADIUS,
      alignItems: 'center'
    },
    nextText: {
      color: palette.onAccent,
      fontWeight: 'bold'
    },
    dismiss: {
      textAlign: 'center',
      textDecorationLine: 'underline',
      color: palette.hint
    }
  })
