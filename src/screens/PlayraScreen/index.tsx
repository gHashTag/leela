import React, { useEffect, useState } from 'react'
import { StyleSheet, View, FlatList, Image, TouchableOpacity } from 'react-native'
import { observer } from 'mobx-react-lite'
import * as Sentry from '@sentry/react-native'
import { s, vs } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import { AppContainer, ButtonElements, SocialLinks, Space, Text } from '../../components'
import { ThemeProvider } from 'react-native-elements'
import { OpenVideoModal, primary, secondary } from '../../constants'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Spin from 'react-native-spinkit'
import Orientation from 'react-native-orientation-locker'
import { useFocusEffect } from '@react-navigation/native'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLAYRA_SCREEN'>

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

interface PlayraItemT {
  item: {
    id: number
    videoUrl: string
    title: string
    mantra: string
    artist: string
    poster: string
  }
  index: number
}

export const PlayraScreen = observer(({ navigation }: PlayraScreenT) => {
  const [data, setArray] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const getData = async () => {
      try {
        let response = await fetch(
          'https://s3.eu-central-1.wasabisys.com/database999/Playra/AlbumMahaKumbhaMela/playraClips.json'
        )
        setArray(await response.json())
        setLoading(false)
      } catch (e) {
        Sentry.captureException(e)
        setLoading(false)
      }
    }
    getData()
  }, [])

  useFocusEffect(() => {
    setTimeout(() => Orientation.lockToPortrait(), 500)
  })

  const _keyExtractor = (obj: any) => obj.id.toString()

  return (
    <AppContainer
      title="Playra"
      iconLeft=":back:"
      iconRight={null}
      onPress={() => {
        navigation.goBack()
      }}
    >
      <FlatList
        style={{ width: '100%' }}
        ListFooterComponent={
          <>
            <Space height={vs(25)} />
            <Text textStyle={centerTxt} h={'h1'} title={I18n.t('contacts')} />
            <ThemeProvider theme={theme}>
              <SocialLinks music />
              <Space height={vs(130)} />
            </ThemeProvider>
          </>
        }
        ListHeaderComponent={
          loading ? (
            <View style={loadContainer}>
              <Space height={vs(50)} />
              <Spin size={s(80)} type="Bounce" color={primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View>
              <Space height={vs(15)} />
              <Text textStyle={centerTxt} h="h3" title={I18n.t('loadErr')} />
            </View>
          )
        }
        data={data.slice().reverse()}
        renderItem={({ item, index }) => <RenderItem item={item} index={index} />}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
})

const RenderItem = ({ item, index }: PlayraItemT) => {
  const { title, videoUrl, poster } = item
  if (!videoUrl || !title || !poster) return null
  function handlePress() {
    OpenVideoModal({ uri: videoUrl, poster })
  }
  return (
    <View style={{ width: '90%', alignSelf: 'center' }}>
      <Space height={vs(10)} />
      <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
        <Text h={'h1'} title={title} />
        <Space height={vs(20)} />
        <View style={videoView}>
          <Image style={posterS} source={{ uri: poster }} />
        </View>
      </TouchableOpacity>
      <Space height={vs(10)} />
      {/* {artist !== '' && (
            <Text
              h={'h4'}
              title={artist}
              textStyle={{ paddingHorizontal: 40, textAlign: 'center' }}
            />
          )} */}
      <Space height={vs(30)} />
    </View>
  )
}

const styles = StyleSheet.create({
  videoView: {
    height: s(200),
    width: '100%'
  },
  posterS: {
    flex: 1,
    borderRadius: s(10)
  },
  loadContainer: {
    width: '100%',
    alignItems: 'center'
  },
  centerTxt: {
    textAlign: 'center'
  }
})
const { videoView, posterS, loadContainer, centerTxt } = styles
