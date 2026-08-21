/* eslint-disable react-native/no-unused-styles */
import React, { memo } from 'react'

import {
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native'
import FastImage from 'react-native-fast-image'
import { s } from 'react-native-size-matters'
import Spinner from 'react-native-spinkit'

import { secondary } from '../../constants'
import { Pressable } from '../Pressable'

type sizeType = 'xLarge' | 'large' | 'medium' | 'small'

const defaultAvatar = require('./pickaface.png')

interface AvatarT {
  loading: boolean
  size?: sizeType
  uri?: string | number
  viewStyle?: StyleProp<ViewStyle>
  localImageSource?: ImageSourcePropType
}
export const Avatar = memo<AvatarT>(
  ({ loading, uri, localImageSource, size = 'large', viewStyle }) => {
    const numericUri = typeof uri === 'number' ? uri : undefined
    const stringUri = typeof uri === 'string' ? uri : undefined

    const source: ImageSourcePropType = numericUri
      ? numericUri
      : stringUri
        ? { uri: stringUri, priority: FastImage.priority.high }
        : localImageSource || defaultAvatar

    return (
      <View style={[styles.container, viewStyle]} testID="avatar">
        {loading ? (
          <Spinner size={styles[size].height} type="Pulse" color={secondary} />
        ) : (
          <FastImage style={styles[size]} source={source} />
        )}
      </View>
    )
  }
)

interface PressableAvatarT extends AvatarT {
  onPress?: () => void
}

export const PressableAvatar = ({ onPress, ...props }: PressableAvatarT) => {
  return (
    <Pressable onPress={onPress}>
      <Avatar {...props} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    borderRadius: s(130),
    overflow: 'hidden'
  },
  xLarge: {
    marginLeft: 1,
    width: s(120),
    height: s(120),
    borderRadius: s(130)
  },
  large: {
    marginLeft: 1,
    width: s(75),
    height: s(75),
    borderRadius: s(75)
  },
  medium: {
    width: s(50),
    height: s(50),
    borderRadius: s(50)
  },
  small: {
    width: s(36),
    height: s(36),
    borderRadius: s(36)
  }
})
