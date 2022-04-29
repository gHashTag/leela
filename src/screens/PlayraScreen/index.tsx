import React, { useEffect, useState } from 'react'
import { Linking, StyleSheet, View, FlatList } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer, Observer } from 'mobx-react-lite'
import * as Sentry from '@sentry/react-native'
import { s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import {
  AppContainer,
  ButtonPlay,
  Row,
  Space,
  Text,
  YouTubePlayer
} from '../../components'
import { Icon, ThemeProvider } from 'react-native-elements'
import { goBack, openUrl, secondary } from '../../constants'
import { actionPlay, PlayButtonStore } from '../../store'

type navigation = StackNavigationProp<RootStackParamList, 'PLAYRA_SCREEN'>

type PlayraScreenT = {
  navigation: navigation
}

const theme = {
  Button: {
    titleStyle: {
      color: secondary,
      padding: 30
    }
  },
  colors: {
    primary: secondary
  }
}

const styles = StyleSheet.create({
  containerStyle: {
    margin: 20
  }
})

interface PlayraItemT {
  item: {
    id: number
    audioUrl: string
    videoUrl: string
    title: string
    mantra: string
    artist: string
    artwork: string
  }
  index: number
}

const PlayraScreen = observer(({ navigation }: PlayraScreenT) => {
  const [data, setArray] = useState<string[]>([])

  const { containerStyle } = styles

  useEffect(() => {
    const getData = async () => {
      try {
        let response = await fetch(
          'https://s3.eu-central-1.wasabisys.com/ghashtag/Playra/AlbumMahaKumbhaMela/playraPhoto.json'
        )
        setArray(await response.json())
      } catch (e) {
        Sentry.captureException(e)
      }
    }
    getData()
  }, [navigation])

  const _keyExtractor = (obj: any) => obj.id.toString()

  return (
    <AppContainer
      title="Playra"
      onPress={() => {
        goBack(navigation)()
        actionPlay.stop()
      }}
    >
      <FlatList
        style={{ width: '100%' }}
        ListFooterComponent={
          <>
            <Space height={s(50)} />
            <Text
              textStyle={{ textAlign: 'center' }}
              h={'h1'}
              title={I18n.t('contacts')}
            />
            <ThemeProvider theme={theme}>
              <Row>
                <Icon
                  name="soundcloud"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() =>
                    openUrl('https://soundcloud.com/play_ra/sets/all-mix-playra')
                  }
                />
                <Icon
                  name="instagram"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://instagram.com/playra')}
                />
                <Icon
                  name="facebook"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://www.facebook.com/playraMusic')}
                />
                <Icon
                  name="spotify"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() =>
                    openUrl(' https://open.spotify.com/album/3oYpszdQXVgtGzVq02u79Z')
                  }
                />
              </Row>
              <Row>
                <Icon
                  name="telegram"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://t.me/leelachakraapp')}
                />
                <Icon
                  name="apple"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() =>
                    openUrl(
                      'https://music.apple.com/ru/album/maha-kumbha-mela/1551347338?at=1000l9WJ&ct=bq&uo=4&app=music'
                    )
                  }
                />

                <Icon
                  name="odnoklassniki"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://ok.ru/music/playlist/15044903371')}
                />
                <Icon
                  name="vk"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://vk.com/playramusic')}
                />
              </Row>

              <Space height={s(400)} />
            </ThemeProvider>
          </>
        }
        data={data.slice()}
        renderItem={({ item, index }) => <RenderItem item={item} index={index} />}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
})

const RenderItem = ({ item, index }: PlayraItemT) => {
  const { title, videoUrl, mantra, artist } = item
  return (
    <View style={{ width: '90%', alignSelf: 'center' }}>
      {videoUrl !== '' && (
        <>
          <Space height={s(20)} />
          {title !== '' && <Text h={'h1'} title={title} />}
          <Space height={s(20)} />
          {videoUrl !== '' && <YouTubePlayer uri={videoUrl} />}
          {/* {audioUrl !== '' && (
 <ButtonPlay type={PlayButtonStore.play} obj={{ id, url: audioUrl, title, artist, artwork }} />
)} */}

          {mantra !== '' && (
            <>
              <Space height={s(20)} />
              <Text
                h={'h4'}
                title={mantra}
                textStyle={{ paddingHorizontal: 40, textAlign: 'center' }}
              />
              <Space height={s(10)} />
            </>
          )}
          {artist !== '' && (
            <Text
              h={'h4'}
              title={artist}
              textStyle={{ paddingHorizontal: 40, textAlign: 'center' }}
            />
          )}
          <Space height={s(70)} />
        </>
      )}
    </View>
  )
}

export { PlayraScreen }
