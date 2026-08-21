import React, { memo } from 'react'
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle
} from 'react-native'
import { ScaledSheet, ms, s } from 'react-native-size-matters'

import { Text } from '../'
import { Pressable } from '../Pressable'
import { black, isIos, white } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'

interface LoadingButtonT {
  title: string
  onPress?: () => void
  loading?: boolean
  disabled?: boolean
  viewStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  cancel?: boolean
  /** Haptic type fired on press when not loading/disabled. */
  haptic?: 'impactLight' | 'impactMedium'
}

const LoadingButton = memo<LoadingButtonT>(
  ({
    title,
    onPress,
    loading = false,
    disabled = false,
    viewStyle,
    textStyle,
    cancel,
    haptic = 'impactLight'
  }) => {
    const handlePress = () => {
      if (loading || disabled) return
      triggerHaptic(haptic)
      onPress?.()
    }

    return (
      <Pressable
        onPress={handlePress}
        style={[
          styles.container,
          { backgroundColor: cancel ? '#FF3B30' : '#007AFF' },
          viewStyle,
          (loading || disabled) && styles.disabled
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading || disabled, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={white} />
        ) : (
          <Text h="h1" title={title} textStyle={[styles.h, textStyle]} />
        )}
      </Pressable>
    )
  }
)

const styles = ScaledSheet.create({
  container: {
    alignSelf: 'center',
    width: ms(230, 0.9),
    height: ms(50, 0.9),
    borderRadius: s(40),
    borderWidth: 1,
    borderColor: black,
    justifyContent: 'center'
  },
  h: {
    textAlign: 'center',
    paddingHorizontal: 15,
    top: isIos ? 3 : -2,
    color: white
  },
  disabled: {
    opacity: 0.6
  }
})

export { LoadingButton }
