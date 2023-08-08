import React from 'react'

import { StyleSheet, View } from 'react-native'

const styles = StyleSheet.create({
  main: {
    justifyContent: 'center',
    alignItems: 'center'
  }
})

const CenterView = ({ children, flex = 1 }) => {
  return <View style={[styles.main, { flex }]}>{children}</View>
}

export { CenterView }
