import * as Sentry from '@sentry/react-native'
import React, { Component, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  StyleSheet,
  useColorScheme,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { secondary, white } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundaryBase extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack }
    })
  }

  handleRetry = () => {
    triggerHaptic('impactMedium')
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }
    return this.props.children
  }
}

interface ErrorFallbackT {
  error?: Error
  onRetry: () => void
}

function ErrorFallback({ error, onRetry }: ErrorFallbackT) {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  return (
    <View style={styles.container}>
      <Text
        h="h1"
        title={t('errorBoundary.title')}
        textStyle={[styles.title, { color: isDark ? white : '#1C1C1E' }]}
      />
      <Space height={vs(12)} />
      <Text
        h="h5"
        title={t('errorBoundary.message')}
        textStyle={[styles.message, { color: isDark ? white : '#3A3A3C' }]}
      />
      {__DEV__ && error && (
        <>
          <Space height={vs(16)} />
          <Text
            h="h6"
            title={`${error.name}: ${error.message}`}
            textStyle={styles.devError}
          />
        </>
      )}
      <Space height={vs(28)} />
      <Pressable
        onPress={onRetry}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={t('errorBoundary.retry')}
      >
        <Text
          h="h3"
          title={t('errorBoundary.retry')}
          textStyle={styles.buttonText}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(32)
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  message: {
    textAlign: 'center',
    lineHeight: s(22)
  },
  devError: {
    color: '#FF3B30',
    textAlign: 'center'
  },
  button: {
    backgroundColor: secondary,
    paddingVertical: s(12),
    paddingHorizontal: s(28),
    borderRadius: s(24)
  },
  buttonText: {
    color: white,
    fontWeight: 'bold'
  }
})

export { ErrorBoundaryBase as ErrorBoundary }
