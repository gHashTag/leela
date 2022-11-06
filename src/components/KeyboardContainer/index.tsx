import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import React from 'react'
import { useHeaderHeight } from '@react-navigation/elements'
import { SafeAreaView } from 'react-native-safe-area-context'

export function KeyboardContainer({ children, behavior }: KeyboardContainerT) {
  const headerH = useHeaderHeight()

  return Platform.OS === 'ios' ? (
    <KeyboardAvoidingView
      style={container}
      behavior="padding"
      keyboardVerticalOffset={headerH}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    <SafeAreaView style={container}>{children}</SafeAreaView>
  )
}

interface KeyboardContainerT {
  children: any
  behavior?: 'height' | 'padding' | 'position'
}

const style = StyleSheet.create({
  container: {
    flex: 1
  }
})

const { container } = style
