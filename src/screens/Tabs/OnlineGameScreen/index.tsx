import React, { useEffect, useState } from 'react'
import { StyleSheet, ScrollView, View } from 'react-native'
import { observer } from 'mobx-react'
import { s, vs } from 'react-native-size-matters'
import { I18n } from '../../../utils'
import { RootStackParamList, RootTabParamList } from '../../../types'
import {
  Background,
  Header,
  ImageSwiper,
  SocialLinks,
  Space,
  Text
} from '../../../components'
import { captureException } from '../../../constants'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Markdown from 'react-native-markdown-display'
import { useMarkdownProps } from '../../../hooks'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_3'
>

type OnlineGameScreenT = {
  navigation: navigation
}

// const theme = {
//   Button: {
//     titleStyle: {
//       color: secondary,
//       padding: 30
//     },
//     containerStyle: {
//       width: s(240),
//       alignSelf: 'center'
//     }
//   },

//   colors: {
//     primary: secondary
//   }
// }

const OnlineGameScreen = observer(({ navigation }: OnlineGameScreenT) => {
  const [images, setImages] = useState<string[]>([])
  const [mdContent, setMdContent] = useState<string>('')
  const mdProps = useMarkdownProps(0.94, 0.94)

  useEffect(() => {
    const getData = async () => {
      try {
        const images = await (
          await fetch(
            'https://leelachakra.com/resource/LeelaChakra/PhotoLeela/leelaPhoto.json'
          )
        ).json()
        setImages(images)
        const mdContent = await (
          await fetch(
            'https://leelachakra.com/resource/LeelaChakra/InfoAboutGameAndAuthors/ru.md'
          )
        ).text()
        setMdContent(mdContent)
      } catch (error) {
        captureException(error)
      }
    }
    getData()
  }, [])

  const poster =
    'https://leelachakra.com/resource/Playra/AlbumMahaKumbhaMela/Our-way-of-evolution.jpg'
  const uri =
    'https://leelachakra.com/resource/Playra/AlbumMahaKumbhaMela/Our-way-of-evolution.mp4'

  return (
    <Background>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header title={I18n.t('events')} textAlign="center" />
        <Space height={s(20)} />
        <ImageSwiper images={images} height={vs(300)} />
        <Space height={s(10)} />
        {/* <Text textStyle={centered} h={'h3'} title={I18n.t('author')} 
            {lang !== 'en' && (
              <View style={containerStyle}>
                <VideoPlayer paused source={{ uri }} poster={poster} />
              </View>
            )}*/}
        <View style={mdStyle}>
          <Markdown {...mdProps}>{mdContent}</Markdown>
          <Text textStyle={centered} h={'h3'} title={I18n.t('contacts')} />
          <SocialLinks />
          <Space height={vs(130)} />
          {/* <ButtonElements
            title={I18n.t('more')}
            onPress={() => navigation.navigate('PLAYRA_SCREEN')}
          /> */}
        </View>
      </ScrollView>
    </Background>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  containerStyle: {
    height: vs(250),
    width: '100%'
  },
  mdStyle: {
    paddingHorizontal: s(8)
  },
  centered: {
    textAlign: 'center'
  }
})
const { centered, container, containerStyle, mdStyle } = styles

export { OnlineGameScreen }
