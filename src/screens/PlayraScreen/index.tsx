import React, { useEffect, useState } from 'react'
import { Linking, StyleSheet, View, FlatList } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer, Observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../'
import { AppContainer, ButtonPlay, Row, Space, Txt, YouTubePlayer } from '../../components'
import { Icon, ThemeProvider } from 'react-native-elements'
import { goBack, secondary } from '../../constants'
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
}

const PlayraScreen = observer(({ navigation }: PlayraScreenT) => {
  const [data, setArray] = useState<string[]>([])

  const openUrl = async (url: string) => {
    await Linking.openURL(url)
  }

  const { containerStyle } = styles

  useEffect(() => {
    const getData = async () => {
      try {
        let response = await fetch(
          'https://s3.eu-central-1.wasabisys.com/ghashtag/Playra/AlbumMahaKumbhaMela/playraPhoto.json'
        )
        setArray(await response.json())
      } catch (e) {
        console.log('e.message', e.message)
      }
    }
    getData()
  }, [navigation])

  const _renderItem = ({ item }: PlayraItemT) => {
    const { id, title, audioUrl, videoUrl, mantra, artist, artwork } = item

    return (
      <Observer>
        {() => (
          <View key={id} style={{ width: '100%' }}>
            <Space height={s(20)} />
            {title !== '' && <Txt h0 title={title} />}
            <Space height={s(20)} />
            {videoUrl !== '' && <YouTubePlayer uri={videoUrl} />}
            <Space height={s(20)} />
            <ButtonPlay type={PlayButtonStore.play} obj={{ id, url: audioUrl, title, artist, artwork }} />

            {mantra !== '' && (
              <>
                <Space height={s(20)} />
                <Txt h3 title={mantra} textStyle={{ paddingHorizontal: 40 }} textAlign="center" />
                <Space height={s(10)} />
              </>
            )}

            {artist !== '' && <Txt h2 title={artist} textStyle={{ paddingHorizontal: 40 }} textAlign="center" />}
            <Space height={s(70)} />
          </View>
        )}
      </Observer>
    )
  }

  const _keyExtractor = (obj: any) => obj.id.toString()

  return (
    <AppContainer
      title="Playra"
      flatList
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
            <Txt h1 title={I18n.t('contacts')} />
            <ThemeProvider theme={theme}>
              <Row>
                <Icon
                  name="soundcloud"
                  type="font-awesome"
                  color={secondary}
                  size={40}
                  containerStyle={containerStyle}
                  onPress={() => openUrl('https://soundcloud.com/play_ra/sets/all-mix-playra')}
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
                  onPress={() => openUrl(' https://open.spotify.com/album/3oYpszdQXVgtGzVq02u79Z')}
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
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
})

export { PlayraScreen }
