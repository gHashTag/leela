import React, { Fragment, useEffect, useState } from 'react'
import { StyleSheet, ScrollView, View } from 'react-native'
import { observer } from 'mobx-react'
import { s, vs } from 'react-native-size-matters'
import { I18n, lang } from '../../../utils'
import { RootStackParamList, RootTabParamList } from '../../../types'
import {
  Background,
  ButtonWithIcon,
  Header,
  ImageSwiper,
  SocialLinks,
  Space,
  Text
} from '../../../components'
import { captureException, fuchsia } from '../../../constants'
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

const OnlineGameScreen = observer(({ navigation }: OnlineGameScreenT) => {
  const [images, setImages] = useState<string[]>([])
  const [mdContent, setMdContent] = useState<string[]>([])
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
        const mdContent1 = await (
          await fetch(
            `https://leelachakra.com/resource/LeelaChakra/InfoAboutGameAndAuthors/${lang}1.md`
          )
        ).text()
        const mdContent2 = await (
          await fetch(
            `https://leelachakra.com/resource/LeelaChakra/InfoAboutGameAndAuthors/${lang}2.md`
          )
        ).text()
        setMdContent([mdContent1, mdContent2])
      } catch (error) {
        captureException(error)
      }
    }
    getData()
  }, [])

  const renderMarkdownPart = (part: string, id: number) => {
    switch (id) {
      case 0:
        return (
          <Fragment key={id}>
            <Markdown {...mdProps}>{part}</Markdown>
            <Space height={vs(15)} />
            <ButtonWithIcon
              viewStyle={btn}
              color={fuchsia}
              onPress={() => navigation.navigate('PLAYRA_SCREEN')}
              iconName="ios-musical-notes"
              title={I18n.t('clips')}
            />
            <Space height={vs(15)} />
          </Fragment>
        )
      default:
        return (
          <Fragment key={id}>
            <Markdown {...mdProps}>{part}</Markdown>
          </Fragment>
        )
    }
  }

  return (
    <Background>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header title={I18n.t('events')} textAlign="center" />
        <Space height={s(20)} />
        <ImageSwiper images={images} height={vs(300)} />
        <Space height={s(10)} />
        <View style={mdStyle}>
          {mdContent?.map(renderMarkdownPart)}
          <Space height={vs(10)} />
          <Text textStyle={centered} h="h3" title={I18n.t('contacts')} />
          <SocialLinks />
          <Space height={vs(130)} />
        </View>
      </ScrollView>
    </Background>
  )
})

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center'
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
const { centered, btn, containerStyle, mdStyle } = styles

export { OnlineGameScreen }
