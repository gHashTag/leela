import React from 'react'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'
import Spinner from 'react-native-spinkit'

import { secondary } from '../../constants'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

interface LoadingT {
  paddingTop?: number
  size?: number
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
}

const Loading = ({
  paddingTop = 0,
  size = s(65),
  type = 'Pulse'
}: LoadingT) => {
  return (
    <View style={[styles.container, { paddingTop }]}>
      <Spinner size={size} type={type} color={secondary} isVisible={true} />
    </View>
  )
}

export { Loading }
