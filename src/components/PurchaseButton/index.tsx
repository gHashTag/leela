import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps
} from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'
import { s } from 'react-native-size-matters'
import { Text } from '../../components'
import { RADIUS, SPACE, TOUCH, useTheme, type Palette } from '../../theme'

interface PurchaseButtonProps extends TouchableOpacityProps {
  title: string
  selectedPackage?: PurchasesPackage | null
  onPress: () => void
}

const PurchaseButton: React.FC<PurchaseButtonProps> = ({
  title,
  selectedPackage,
  onPress
}) => {
  const { t } = useTranslation()
  const palette = useTheme()
  const styles = React.useMemo(() => stylesFor(palette), [palette])

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!selectedPackage}
      /*
       * The button that spends money, named and with its state said aloud.
       *
       * `disabled` alone dims it on screen and tells assistive technology
       * nothing, so a player who could not see the dimming was left tapping a
       * control that would never respond and no reason given.
       */
      accessibilityRole="button"
      accessibilityLabel={t(title)}
      accessibilityState={{ disabled: !selectedPackage }}
      accessibilityHint={
        selectedPackage
          ? undefined
          : t('subscription.pickPlanFirst') || 'Choose a plan first'
      }
      style={[styles.purchaseButton, !selectedPackage && styles.disabledButton]}
    >
      {/*
        `oneColor`, not a colour in the sheet.

        `buttonText` asked for white and the button drew its label in magenta:
        `Text` paints a gradient unless it is given a single colour, so the
        `color` written here was never used. On the blue fill that produced
        magenta on blue - the least legible pair on the whole screen, on its
        one button.
      */}
      <Text
        h="h3"
        oneColor={selectedPackage ? palette.onAccent : palette.hint}
        textStyle={styles.buttonText}
        title={t(title)}
      />
    </TouchableOpacity>
  )
}

/**
 * The one thing this screen is for, in the colour the app uses for that.
 *
 * It was `trueBlue` - a colour belonging to no scheme and to nothing else in
 * the app, sitting under a board whose accent is green. The width was `s(170)`,
 * a button narrower than the rows of prices above it: the primary action was
 * the smallest control on the page.
 */
const stylesFor = (palette: Palette) =>
  StyleSheet.create({
    purchaseButton: {
      backgroundColor: palette.accent,
      paddingVertical: Platform.OS === 'ios' ? s(12) : s(5),
      paddingHorizontal: SPACE.lg,
      minHeight: TOUCH,
      justifyContent: 'center',
      borderRadius: RADIUS,
      alignSelf: 'stretch'
    },
    disabledButton: {
      // Still a button, visibly not ready. `raised` rather than a flat grey, so
      // it belongs to the same surface as the rows above it in both schemes.
      backgroundColor: palette.raised
    },
    buttonText: {
      fontWeight: 'bold',
      textAlign: 'center',
      alignSelf: 'center',
      /*
       * No shadow behind the label.
       *
       * `Text` adds `textShadowColor: primary` to every size except the five it
       * lists as shadowless, and `primary` comes from the navigation theme -
       * the app's magenta. So a white label on the green button was drawn with
       * a magenta shadow under it and read as magenta: the button said its own
       * name in the least legible colour available.
       *
       * Killed here rather than by choosing a shadowless size, so the label
       * keeps the size it should have. `textStyle` is applied after the size's
       * own style, so this wins.
       */
      textShadowColor: 'transparent',
      textShadowRadius: 0
    }
  })

export { PurchaseButton }
