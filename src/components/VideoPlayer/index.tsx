import React, { useRef } from 'react'

import { StyleSheet } from 'react-native'
import { VideoProperties } from 'react-native-video'
import Video from 'react-native-video-controls'

const styles = StyleSheet.create({
  container: {
    flex: 1
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
