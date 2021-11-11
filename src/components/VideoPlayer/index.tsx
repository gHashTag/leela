import React, { useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'
import Video from 'react-native-video'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  }
})

type VideoPlayerT = {
  uri: string
}

const VideoPlayer = ({ uri }: VideoPlayerT) => {
  const playerRef = useRef<Video>(null)
  return <Video style={styles.container} ignoreSilentSwitch="ignore" ref={playerRef} source={{ uri }} />
}

export { VideoPlayer }
