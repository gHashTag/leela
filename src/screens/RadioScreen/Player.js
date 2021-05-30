import React, { useState, useEffect, useRef } from 'react'
import Video from 'react-native-video'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import TrackPlayer, { usePlaybackState, useTrackPlayerEvents } from 'react-native-track-player'
import BackgroundTimer from 'react-native-background-timer'
import * as Sentry from '@sentry/react-native'
import { PlayButtonStore, actionPlay, actionsSubscribe, SubscribeStore } from '../../store'
import { I18n } from '../../utils'
import { useTheme } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'
import { ButtonSimple, Space, Txt } from '../../components'
import { W, defUrl } from '../../constants'

const styles = StyleSheet.create({
  cardStyle: {
    width: '80%',
    alignItems: 'center',
    alignSelf: 'center'
  },
  coverStyle: {
    width: s(160),
    height: s(160),
    backgroundColor: 'transparent'
  },
  progress: {
    height: 1,
    width: '90%',
    marginTop: 10,
    flexDirection: 'row'
  },
  titleStyle: {
    marginTop: 10
  },
  artistStyle: {
    fontWeight: 'bold'
  },
  controlsStyle: {
    marginVertical: 5,
    alignSelf: 'center',
    flexDirection: 'row'
  },
  controlButtonContainer: {
    flex: 1
  },
  controlButtonText: {
    fontSize: s(40),
    width: s(100),
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'The Dolbak' : 'TheDolbak-Brush'
  },
  h: {
    width: W - 100,
    textAlign: 'center'
  }
})

// const ProgressBar = () => {
//   const progress = useTrackPlayerProgress()
//   const {
//     colors: { primary }
//   } = useTheme()
//   return (
//     <View style={styles.progress}>
//       <View style={{ flex: progress.position, backgroundColor: primary }} />
//       <View
//         style={{
//           flex: progress.duration - progress.position,
//           backgroundColor: 'grey'
//         }}
//       />
//     </View>
//   )
// }

const { controlButtonContainer, controlButtonText, cardStyle, coverStyle, controlsStyle, h } = styles

function ControlButton({ title, onPress }) {
  const {
    colors: { primary }
  } = useTheme()
  return (
    <TouchableOpacity style={controlButtonContainer} onPress={onPress}>
      <Text style={[controlButtonText, { color: primary }]}>{title}</Text>
    </TouchableOpacity>
  )
}

const Player = observer(() => {
  const [track, setTrack] = useState('')
  // const playbackState = usePlaybackState()
  //

  // const setup = async () => {
  //   await TrackPlayer.setupPlayer({
  //     iosCategory: 'playAndRecord',
  //     iosCategoryMode: 'default',
  //     iosCategoryOptions: [],
  //     waitForBuffer: true
  //   })
  //   await TrackPlayer.updateOptions({
  //     stopWithApp: false,
  //     capabilities: [
  //       TrackPlayer.CAPABILITY_PLAY,
  //       TrackPlayer.CAPABILITY_PAUSE,
  //       TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
  //       TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
  //       TrackPlayer.CAPABILITY_STOP
  //     ],
  //     compactCapabilities: [TrackPlayer.CAPABILITY_PLAY, TrackPlayer.CAPABILITY_PAUSE]
  //   })
  // }

  // const getAsyncStorageData = async () => {
  //   const jsonValue = await AsyncStorage.getItem('@track')
  //   const value = jsonValue != null ? JSON.parse(jsonValue) : null
  //   if (value !== null) {
  //     setTrack(value)
  //   }
  // }

  // useEffect(() => {
  //   const checkPay = async () => {
  //     try {
  //       if (SubscribeStore.subscriptionActive) {
  //         // Unlock that great "pro" content
  //         actionPlay.radio(0, defUrl)
  //         setup()
  //         getAsyncStorageData()
  //       } else {
  //         const getData = () => {
  //           const date = new Date().getDate()
  //           const month = new Date().getMonth() + 1
  //           const year = new Date().getFullYear()
  //           return date + '-' + month + '-' + year
  //         }
  //         // console.warn('getData() === SubscribeStore.today', getData() === SubscribeStore.today)
  //         if (getData() === SubscribeStore.today) {
  //           actionPlay.stop()
  //           actionsSubscribe.setVisible(true)
  //         } else {
  //           actionPlay.radio(0, defUrl)
  //           setup()
  //           getAsyncStorageData()
  //           BackgroundTimer.runBackgroundTimer(async () => {
  //             actionsSubscribe.setToday(getData())
  //             actionPlay.stop()
  //             actionsSubscribe.setVisible(true)
  //           }, 1800000)
  //         }
  //       }
  //     } catch (e) {
  //       Sentry.captureException(e)
  //     }
  //   }
  //   checkPay()
  // }, [])

  // const togglePlayback = async () => {
  //   const currentTrack = await TrackPlayer.getCurrentTrack()
  //   if (currentTrack == null) {
  //     await TrackPlayer.reset()
  //     await TrackPlayer.add(PlayButtonStore.array)
  //     await TrackPlayer.play()
  //   } else if (playbackState === TrackPlayer.STATE_PAUSED) {
  //     await TrackPlayer.play()
  //   } else {
  //     await TrackPlayer.pause()
  //   }
  // }

  // useTrackPlayerEvents(['playback-track-changed'], async event => {
  //   if (event.type === TrackPlayer.TrackPlayerEvents.PLAYBACK_TRACK_CHANGED) {
  //     const tr = await TrackPlayer.getTrack(event.nextTrack)
  //     const jsonValue = JSON.stringify(tr)
  //     await AsyncStorage.setItem('@track', jsonValue)

  //     tr && setTrack(tr)
  //   }
  // })

  // let middleButtonText = 'Play'

  // if (playbackState === TrackPlayer.STATE_PLAYING || playbackState === TrackPlayer.STATE_BUFFERING) {
  //   middleButtonText = 'Pause'
  // }

  const { title, artwork, artist } = track
  const playerRef = useRef(null)

  return (
    <View style={[cardStyle]}>
      <>
        {!SubscribeStore.subscriptionActive && (
          <>
            <Txt h3 title={I18n.t('limit')} />
            <ButtonSimple h="h1" title={I18n.t('buy')} onPress={() => actionsSubscribe.setVisible(true)} />
            <Space height={20} />
          </>
        )}
        <Image style={coverStyle} source={{ uri: artwork }} />
        <Space height={10} />
        {title !== '' && <Txt h1 title={title} textStyle={h} />}
        <Txt h4 title={artist} textStyle={h} />
        <Video ignoreSilentSwitch="ignore" ref={playerRef} source={{ uri: PlayButtonStore.url }} audioOnly />
        <Space height={10} />
        <View style={controlsStyle}>
          <ControlButton title={'<<'} onPress={actionPlay.skipToPrevious} />
          {/* <ControlButton title={middleButtonText} onPress={togglePlayback} /> */}
          <ControlButton title={'>>'} onPress={actionPlay.skipToNext} />
        </View>
      </>
    </View>
  )
})

export { Player }
