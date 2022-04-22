import React, { memo, useState, useEffect } from 'react'
import { StyleSheet, StyleProp, ViewStyle, TouchableOpacity, View, Image } from 'react-native'
import { primary, secondary } from '../../constants'
import { s, ms } from 'react-native-size-matters'
import Spinner from 'react-native-spinkit'
import FastImage from 'react-native-fast-image'

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center'
  },
  xLarge: {
    marginLeft: 1,
    width: ms(130),
    height: ms(130),
    borderRadius: ms(130) / 2
  },
  large: {
    marginLeft: 1,
    width: s(75),
    height: s(75),
    borderRadius: 75 / 2
  },
  medium: {
    width: s(50),
    height: s(50),
    borderRadius: s(50) / 2
  },
  small: {
    width: s(36),
    height: s(36),
    borderRadius: s(36) / 2
  }
})

type sizeType = 'xLarge' | 'large' | 'medium' | 'small'

interface AvatarT {
  loading: boolean
  onPress?: () => void
  size?: sizeType
  uri?: string
  viewStyle?: StyleProp<ViewStyle>
}

const Avatar = memo<AvatarT>(({ loading = true, uri, size = 'large', onPress, viewStyle }) => {
  const { container } = styles
  return (
    <>
      <TouchableOpacity onPress={onPress} style={[container, viewStyle]}>
        <>
          {loading ? (
            <Spinner size={styles[size].height} type="Pulse" color={secondary} />
          ) : (
            <>
              {!uri ? (
                <FastImage style={styles[size]} source={require('./pickaface.png')} />
              ) : (
                //<Image style={styles[size]} source={{ uri }} />
                <FastImage style={styles[size]} source={{ uri, priority: FastImage.priority.high }} />
              )}
            </>
          )}
        </>
      </TouchableOpacity>
    </>
  )
})

export { Avatar }
