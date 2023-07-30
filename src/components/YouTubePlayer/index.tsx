import React, { useCallback, useState } from 'react'

import { useFocusEffect } from '@react-navigation/native'
import {
  AppState,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions
} from 'react-native'
import { s, vs } from 'react-native-size-matters'
import YoutubePlayer, { YoutubeIframeProps } from 'react-native-youtube-iframe'

interface YouTubeT extends Omit<YoutubeIframeProps, 'height' | 'width'> {
  widthCoefficient?: number
}

export const YouTubePlayer = ({ widthCoefficient = 1, ...props }: YouTubeT) => {
  const [playing, setPlaying] = useState(false)
  const width = useWindowDimensions().width * widthCoefficient
  const height = width * 0.5625

  useFocusEffect(
    useCallback(() => {
      const unsub = AppState.addEventListener('change', (state) => {
        if (
          state === 'background' ||
          state === 'inactive' ||
          state === 'extension'
        ) {
          setPlaying(false)
        }
      })
      return () => {
        setPlaying(false)
        unsub.remove
      }
    }, [])
  )

  return (
    <View style={styles.mainBlock}>
      <View
        style={[styles.videoContainer, { height, width }]}
        renderToHardwareTextureAndroid={true}
      >
        <YoutubePlayer
          play={playing}
          /* @ts-ignore */
          height={height}
          /* @ts-ignore */
          width={width}
          webViewStyle={styles.webViewStyle}
          webViewProps={{
            androidLayerType:
              Platform.OS === 'android' && Platform.Version <= 22
                ? 'hardware'
                : 'none'
          }}
          {...props}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mainBlock: {
    marginVertical: vs(10),
    width: '100%',
    alignItems: 'center'
  },
  videoContainer: {
    borderRadius: s(7),
    overflow: 'hidden'
  },
  webViewStyle: {
    // fix bug https://github.com/LonelyCpp/react-native-youtube-iframe/issues/110
    opacity: 0.99
  }
})
