import React, { memo, useEffect, useState } from 'react'

import { useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, Image, StyleSheet, View } from 'react-native'
import { ThemeProvider } from 'react-native-elements'
import Orientation from 'react-native-orientation-locker'
import { s, vs } from 'react-native-size-matters'
import Spin from 'react-native-spinkit'

import { AppContainer, SocialLinks, Space, Text } from '../../components'
import { Pressable } from '../../components/Pressable'
import { OpenVideoModal, captureException, primary, secondary } from '../../constants'
import { RootStackParamList } from '../../types'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLAYRA_SCREEN'>

type PlayraScreenT = {
  navigation: navigation
}

const theme = {
  Button: {
    titleStyle: {
      color: secondary,
      padding: 30,
    },
  },
  colors: {
    primary: secondary,
  },
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
}

export const PlayraScreen = observer(({ navigation }: PlayraScreenT) => {
  const [data, setArray] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const { t } = useTranslation()

  useEffect(() => {
    const getData = async () => {
      try {
        let response = await fetch(
          'https://leelachakra.com/resource/Playra/AlbumMahaKumbhaMela/playraClips.json',
        )
        setArray(await response.json())
        setLoading(false)
      } catch (e) {
        captureException(e, 'getData')
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
      enableBackgroundBottomInsets
      onPress={() => {
        navigation.goBack()
      }}
    >
      <FlatList
        style={page.fullWidth}
        ListFooterComponent={
          <>
            <Space height={vs(25)} />
            <Text textStyle={page.centerTxt} h={'h1'} title={t('contacts')} />
            <ThemeProvider theme={theme}>
              <SocialLinks music />
              <Space height={vs(130)} />
            </ThemeProvider>
          </>
        }
        ListHeaderComponent={
          loading ? (
            <View style={page.loadContainer}>
              <Space height={vs(50)} />
              <Spin size={s(80)} type="Bounce" color={primary} />
            </View>
          ) : (
            <Space height={vs(20)} />
          )
        }
        ListEmptyComponent={
          loading ? null : (
            <View>
              <Space height={vs(15)} />
              <Text textStyle={page.centerTxt} h="h3" title={t('loadErr')} />
            </View>
          )
        }
        data={data.slice().reverse()}
        renderItem={({ item }) => <RenderItem item={item} />}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
})

const RenderItem = memo(({ item }: PlayraItemT) => {
  const { title, videoUrl, poster } = item
  if (!videoUrl || !title || !poster) {
    return null
  }

  function handlePress() {
    OpenVideoModal({ uri: videoUrl, poster })
  }

  return (
    <View style={page.videoContainer}>
      <Space height={vs(10)} />
      <Pressable activeOpacity={0.8} onPress={handlePress}>
        <Text h={'h1'} title={title} />
        <Space height={vs(20)} />
        <View style={page.videoView}>
          <Image style={page.posterS} source={{ uri: poster }} />
        </View>
      </Pressable>
      <Space height={vs(40)} />
    </View>
  )
})

const page = StyleSheet.create({
  videoView: {
    height: s(200),
    width: '100%',
  },
  posterS: {
    flex: 1,
    borderRadius: s(10),
  },
  loadContainer: {
    width: '100%',
    alignItems: 'center',
  },
  centerTxt: {
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  videoContainer: {
    width: '90%',
    alignSelf: 'center',
  },
})
