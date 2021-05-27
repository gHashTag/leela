import React from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import Spinner from 'react-native-spinkit'
import { secondary, black, white } from '../../constants'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50
  }
})

interface SpinT {
  color?: string
}

const Spin = ({ color = secondary }: SpinT) => {
  const scheme = useColorScheme()
  const theme = scheme === 'dark'
  return (
    <View style={[styles.container, { backgroundColor: theme ? black : white }]}>
      <Spinner size={65} type="Pulse" color={color} />
    </View>
  )
}

export { Spin }
