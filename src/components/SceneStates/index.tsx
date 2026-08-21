import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Button, EmptyComments, Space, Text } from '../../components'
import { triggerHaptic } from '../../utils/haptics'

export type SceneState =
  | { type: 'loading' }
  | { type: 'error'; message?: string; onRetry?: () => void }
  | {
      type: 'empty'
      title?: string
      message?: string
      icon?: string
      action?: { title: string; onPress: () => void }
    }
  | { type: 'ready' }

interface SceneStatesT {
  state: SceneState
  children?: React.ReactNode
  /** For "error" state: pull-to-refresh support inside a ScrollView wrapper. */
  refreshing?: boolean
  onRefresh?: () => void
  style?: StyleProp<ViewStyle>
}

export const SceneStates = memo(
  ({ state, children, refreshing, onRefresh, style }: SceneStatesT) => {
    const { t } = useTranslation()
    const { dark, colors } = useTheme()
    const textColor = dark ? colors.text : '#3A3A3C'

    const handleRetry = () => {
      triggerHaptic('impactMedium')
      if (state.type === 'error' && state.onRetry) {
        state.onRetry()
      }
    }

    if (state.type === 'loading') {
      return (
        <View style={[styles.center, style]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Space height={vs(12)} />
          <Text
            h="h6"
            title={t('sceneStates.loading')}
            textStyle={{ color: textColor }}
          />
        </View>
      )
    }

    if (state.type === 'error') {
      const content = (
        <View style={[styles.center, style]}>
          <Text
            h="h4"
            title={t('sceneStates.error')}
            textStyle={[styles.title, { color: textColor }]}
          />
          <Space height={vs(8)} />
          <Text
            h="h6"
            title={state.message || t('sceneStates.errorGeneric')}
            textStyle={[styles.message, { color: textColor }]}
          />
          {state.onRetry && (
            <>
              <Space height={vs(20)} />
              <Pressable
                onPress={handleRetry}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel={t('sceneStates.retry')}
              >
                <Text
                  h="h5"
                  title={t('sceneStates.retry')}
                  textStyle={styles.retryText}
                />
              </Pressable>
            </>
          )}
        </View>
      )

      if (onRefresh) {
        return (
          <ScrollView
            contentContainerStyle={styles.scrollCenter}
            refreshControl={
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            }
          >
            {content}
          </ScrollView>
        )
      }

      return content
    }

    if (state.type === 'empty') {
      const handleAction = () => {
        triggerHaptic('impactMedium')
        if (state.type === 'empty' && state.action) {
          state.action.onPress()
        }
      }

      return (
        <View style={[styles.center, style]}>
          {state.icon && (
            <>
              <Text h="h0" title={state.icon} textStyle={styles.icon} />
              <Space height={vs(16)} />
            </>
          )}
          {!state.icon && <EmptyComments />}
          {!state.icon && <Space height={vs(16)} />}
          <Text
            h="h4"
            title={state.title || t('sceneStates.emptyTitle')}
            textStyle={[styles.title, { color: textColor }]}
          />
          <Space height={vs(8)} />
          {state.message && (
            <Text
              h="h6"
              title={state.message}
              textStyle={[styles.message, { color: textColor }]}
            />
          )}
          {state.action && (
            <>
              <Space height={vs(24)} />
              <Button
                title={state.action.title}
                onPress={handleAction}
                testID="scene-states-empty-action"
              />
            </>
          )}
        </View>
      )
    }

    return <>{children}</>
  }
)

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24)
  },
  scrollCenter: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24)
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  message: {
    textAlign: 'center',
    lineHeight: s(20)
  },
  icon: {
    fontSize: s(48),
    textAlign: 'center'
  },
  retryButton: {
    paddingVertical: s(10),
    paddingHorizontal: s(20),
    borderRadius: s(20),
    backgroundColor: '#007AFF'
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold'
  }
})
