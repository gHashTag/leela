import React, { memo } from 'react'

import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  }
})

interface RowT {
  children: React.ReactNode
  viewStyle?: StyleProp<ViewStyle>
}

const Row = memo<RowT>(({ children, viewStyle }) => {
  const { container } = styles
  return <View style={[container, viewStyle]}>{children}</View>
})

export { Row }
