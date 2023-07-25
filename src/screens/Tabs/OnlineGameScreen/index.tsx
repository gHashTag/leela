import React, { Fragment, useEffect, useState } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
// import en1 from 'assets/about/en1.md'
// import en2 from 'assets/about/en2.md'
// import ru1 from 'assets/about/ru1.md'
// import ru2 from 'assets/about/ru2.md'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import Markdown from 'react-native-markdown-display'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ms, s, vs } from 'react-native-size-matters'
// import { ruOrEnLang } from 'src/i18n'

import {
  Background,
  ButtonWithIcon,
  Header,
  ImageSwiper,
  SocialLinks,
  Space,
  Text,
} from '../../../components'
import { captureException, fuchsia } from '../../../constants'
import { useMarkdownProps } from '../../../hooks'
import { RootStackParamList, RootTabParamList } from '../../../types'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_3'
>

type OnlineGameScreenT = {
  navigation: navigation
}

export const OnlineGameScreen = observer(({ navigation }: OnlineGameScreenT) => {
  const [images, setImages] = useState<string[]>([])
  const [mdContent, setMdContent] = useState<string[]>([])
  const mdProps = useMarkdownProps(0.94, 0.94)

  const { t } = useTranslation()

  // const md1 = ruOrEnLang === 'ru' ? ru1 : en1
  // const md2 = ruOrEnLang === 'ru' ? ru2 : en2
  useEffect(() => {
    const getData = async () => {
      try {
        const imagesData = await (
          await fetch(
            'https://leelachakra.com/resource/LeelaChakra/PhotoLeela/leelaPhoto.json',
          )
        ).json()
        setImages(imagesData)
        const mdContent1 = await (await fetch(md1)).text()
        const mdContent2 = await (await fetch(md2)).text()
        setMdContent([mdContent1, mdContent2])
      } catch (error) {
        captureException(error, 'leelaPhoto.json')
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
              viewStyle={page.btn}
              color={fuchsia}
              onPress={() => navigation.navigate('PLAYRA_SCREEN')}
              iconName="ios-musical-notes"
              title={t('clips')}
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

  const topBackgroundMargin = useSafeAreaInsets().top + ms(37, 0.5)

  return (
    <Background style={[page.bgStyle, { paddingTop: topBackgroundMargin }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header title={t('events')} textAlign="center" />
        <Space height={s(20)} />
        <ImageSwiper images={images} height={vs(300)} />
        <Space height={s(10)} />
        <View style={page.mdStyle}>
          {mdContent?.map(renderMarkdownPart)}
          <Space height={vs(10)} />
          <Text textStyle={page.centered} h="h3" title={t('contacts')} />
          <SocialLinks />
          <Space height={vs(80)} />
        </View>
      </ScrollView>
    </Background>
  )
})

const page = StyleSheet.create({
  btn: {
    alignSelf: 'center',
  },
  bgStyle: {
    opacity: 0.5,
  },
  mdStyle: {
    paddingHorizontal: s(8),
  },
  centered: {
    textAlign: 'center',
  },
})
