import React, { useRef } from 'react'
import { StyleSheet } from 'react-native'
import Video from 'react-native-video-controls'
import { VideoProperties } from 'react-native-video'

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
