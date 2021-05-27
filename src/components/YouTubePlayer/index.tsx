import React, { memo } from 'react'
import { StyleSheet } from 'react-native'
import { s } from 'react-native-size-matters'
import YouTube from 'react-native-youtube'
import { W } from '../../constants'

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', height: W - s(155) }
})

type YouTubePlayerT = {
  uri: string
  play?: boolean
}
const apiKey = 'AIzaSyDLM6S57hfLoFfkovMzxdmO-sCdS8USQqY'

const YouTubePlayer = memo(({ play = false, uri }: YouTubePlayerT) => (
  <YouTube apiKey={apiKey} play={play} resumePlayAndroid={false} videoId={uri} loop style={styles.container} />
))

export { YouTubePlayer }
