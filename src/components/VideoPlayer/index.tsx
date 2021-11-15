import React, { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '@react-navigation/native'
import Video from 'react-native-video'
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
  const [opacity, setOpacity] = useState(0)
  const playerRef = useRef<Video>(null)
  const { dark } = useTheme()
  const { activityIndicator } = styles

  return (
    <>
      <Video
        onBuffer={({ isBuffering }) => setOpacity(isBuffering ? 1 : 0)}
        onLoadStart={() => setOpacity(1)}
        onLoad={() => setOpacity(0)}
        style={styles.container}
        ignoreSilentSwitch="ignore"
        ref={playerRef}
        source={{ uri }}
      />
      {!!opacity && (
        <View style={activityIndicator}>
          <Spinner size={s(65)} type="Pulse" color={dark ? primary : secondary} />
        </View>
      )}
    </>
  )
}

export { VideoPlayer }
