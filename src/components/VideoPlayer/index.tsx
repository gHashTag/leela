import React, { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '@react-navigation/native'
import Video from 'react-native-video-controls'
import { VideoProperties } from 'react-native-video'
import { secondary, primary } from '../../constants'
import Spinner from 'react-native-spinkit'
import { s } from 'react-native-size-matters'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  activityIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

interface VideoPlayerT extends VideoProperties {}

const VideoPlayer = ({ ...VideoProps }: VideoPlayerT) => {
  const playerRef = useRef<Video>(null)
  return (
    <Video
      style={styles.container}
      ignoreSilentSwitch="ignore"
      ref={playerRef}
      disableFullscreen
      disableBack
      {...VideoProps}
    />
  )
}

export { VideoPlayer }
