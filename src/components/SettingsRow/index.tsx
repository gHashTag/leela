import React, { memo, useCallback } from 'react'

import {
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  View,
  ViewStyle
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { dimGray, primary } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'

export interface SettingsRowT {
  /** Visible row title. */
  title: string
  /** Optional subtitle shown under the title. */
  subtitle?: string
  /** Optional emoji or icon character shown on the left. */
  icon?: string
  /** When true the row renders a switch and toggles `value`. */
  toggle?: boolean
  /** Current switch value (only used with `toggle`). */
  value?: boolean
  /** Called when the row or switch is pressed. */
  onPress?: () => void
  /** Trailing value label, e.g. "English" or "22:00". */
  valueLabel?: string
  testID?: string
}

export const SettingsRow = memo(
  ({
    title,
    subtitle,
    icon,
    toggle,
    value,
    onPress,
    valueLabel,
    testID
  }: SettingsRowT) => {
    const handlePress = useCallback(() => {
      if (toggle) {
        triggerHaptic('impactLight')
      }
      onPress?.()
    }, [onPress, toggle])

    const accessibilityState = toggle
      ? { checked: value, selected: value }
      : undefined

    return (
      <Pressable
        style={styles.container}
        onPress={handlePress}
        accessibilityRole={toggle ? 'switch' : 'button'}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        accessibilityState={accessibilityState}
        testID={testID}
      >
        <View style={styles.row}>
          {icon && (
            <>
              <Text h="h8" title={icon} />
              <Space width={s(12)} />
            </>
          )}
          <View style={styles.textBlock}>
            <Text h="h7" title={title} />
            {subtitle && (
              <>
                <Space height={vs(2)} />
                <Text
                  h="h10"
                  title={subtitle}
                  oneColor={dimGray}
                  textStyle={styles.subtitle}
                />
              </>
            )}
          </View>
          <View style={styles.trailing}>
            {valueLabel && !toggle && (
              <Text h="h8" title={valueLabel} oneColor={dimGray} />
            )}
            {toggle && (
              <Switch
                value={value}
                onValueChange={handlePress}
                trackColor={{ false: dimGray, true: primary }}
                thumbColor="#FFFFFF"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
          </View>
        </View>
      </Pressable>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    paddingVertical: vs(12),
    paddingHorizontal: s(16),
    borderRadius: s(12)
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  textBlock: {
    flex: 1,
    marginRight: s(12)
  },
  subtitle: {
    lineHeight: vs(16)
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center'
  }
})
