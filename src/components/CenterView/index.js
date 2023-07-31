import React from 'react'

import { StyleSheet, View } from 'react-native'

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

const CenterView = ({ children, testID }) => {
  return (
    <View testID={testID} style={styles.main}>
      {children}
    </View>
  )
}

export { CenterView }
