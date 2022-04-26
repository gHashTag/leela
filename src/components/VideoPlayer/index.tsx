import React, { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '@react-navigation/native'
import Video from 'react-native-video-controls'
import { secondary, primary } from '../../constants'
import Spinner from 'react-native-spinkit'
import { s } from 'react-native-size-matters'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  },
  activityIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

type VideoPlayerT = {
  uri: string
}

const VideoPlayer = ({ uri }: VideoPlayerT) => {
  const playerRef = useRef<Video>(null)
  return <Video
    style={styles.container}
    ignoreSilentSwitch="ignore"
    ref={playerRef}
    source={{ uri }}
    disableFullscreen
    disableBack
  />
}

export { VideoPlayer }
