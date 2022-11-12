import React from 'react'

import { StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import Spinner from 'react-native-spinkit'

import { black, secondary, white } from '../../constants'
import { CenterView } from '../CenterView'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: vs(50),
  },
})

interface SpinT {
  color?: string
  size?: number
  centered?: boolean
}

const Spin = ({ color = secondary, size = s(65), centered = false }: SpinT) => {
  const scheme = useColorScheme()
  const theme = scheme === 'dark'
  return centered ? (
    <CenterView>
      <Spinner size={size} type="Pulse" color={color} />
    </CenterView>
  ) : (
    <View style={[styles.container, { backgroundColor: theme ? black : white }]}>
      <Spinner size={size} type="Pulse" color={color} />
    </View>
  )
}

export { Spin }
