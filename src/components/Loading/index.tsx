import React from 'react'
import { StyleSheet, View } from 'react-native'
import Spinner from 'react-native-spinkit'
import { useTheme } from '@react-navigation/native'
import { s } from 'react-native-size-matters'
import { secondary } from '../../constants'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  activityIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    bottom: s(150)
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

const Loading = ({ loading = true, paddingTop = 0, size = 65, type = 'Pulse' }: LoadingT) => {
  const { dark } = useTheme()
  const { container, activityIndicator } = styles
  return (
    <View style={[container, { backgroundColor: 'transparent', paddingTop }]}>
      {loading && (
        <View style={activityIndicator}>
          <Spinner size={size} type={type} color={secondary} />
        </View>
      )}
    </View>
  )
}

export { Loading }
