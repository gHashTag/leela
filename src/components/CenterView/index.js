import React from 'react'
import { View, StyleSheet, useColorScheme } from 'react-native'
//import { useTheme } from '@react-navigation/native'

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

const CenterView = ({ children }) => {
  const scheme = useColorScheme()
  //const backgroundColor = scheme === 'dark' ? '#1c1c1c' : '#fff'

  console.log(`scheme`, scheme)
  return <View style={styles.main}>{children}</View>
}

export { CenterView }
