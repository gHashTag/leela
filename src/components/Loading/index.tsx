import React from 'react'
import { StyleSheet, View } from 'react-native'
import Spinner from 'react-native-spinkit'
import { useTheme } from '@react-navigation/native'
import { secondary, black, white } from '../../constants'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center'
  }
})

interface LoadingT {
  paddingTop?: number
  size?: number
  loading?: boolean
  type?:
    | 'CircleFlip'
    | 'Bounce'
    | 'Wave'
    | 'WanderingCubes'
    | 'Pulse'
    | 'ChasingDots'
    | 'ThreeBounce'
    | 'Circle'
    | '9CubeGrid'
    | 'WordPress'
    | 'FadingCircle'
    | 'FadingCircleAlt'
    | 'Arc'
    | 'ArcAlt'
    | 'Plane'
    | undefined
}

const Loading = ({ loading, paddingTop = 0, size = 65, type = 'Pulse' }: LoadingT) => {
  const { dark } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: dark ? black : white, paddingTop }]}>
      {loading && <Spinner size={size} type={type} color={secondary} />}
    </View>
  )
}

export { Loading }
