import { makeAutoObservable } from 'mobx'
// import TrackPlayer from 'react-native-track-player'
import _ from 'lodash'


const PlayButtonStore = makeAutoObservable({
  id: 0,
  play: false,
  url: '',
  array: []
})

export interface TrackT {
  id: number
  url: string
  title: string
  artist?: string
  artwork?: string
}

const actionPlay = {
  async play({ id, url, title, artist = 'Leela Chakra', artwork }: TrackT): Promise<void> {
    if (PlayButtonStore.play) {
      PlayButtonStore.play = false
    } else {
      PlayButtonStore.play = true
    }
  },
  async stop(): Promise<void> {
    PlayButtonStore.play = false
  },
  async radio(id: number, url: string): Promise<void> {
    PlayButtonStore.id = id
    PlayButtonStore.url = url
    let response = await fetch(url)
    let array = await response.json()
    let shuffleArr = _.shuffle(array)
    // await TrackPlayer.add(shuffleArr)
    // await TrackPlayer.play()
  },
  // async skipToNext() {
  //   try {
  //     await TrackPlayer.skipToNext()
  //   } catch (e) {
  //     Sentry.captureException(e)
  //     await TrackPlayer.skip('1')
  //   }
  // },
  // async skipToPrevious() {
  //   const tracks = await TrackPlayer.getQueue()
  //   try {
  //     await TrackPlayer.skipToPrevious()
  //   } catch (e) {
  //     Sentry.captureException(e)
  //     await TrackPlayer.skip((tracks.length - 1).toString())
  //   }
  // }
}

export { PlayButtonStore, actionPlay }
