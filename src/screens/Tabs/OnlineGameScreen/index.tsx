import React, { useEffect, useState } from 'react'
import { StyleSheet, ScrollView, View } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { ThemeProvider } from 'react-native-elements'
import { I18n, lang } from '../../../utils'
import { RootStackParamList, RootTabParamList } from '../../../types'
import {
  Background,
  ButtonElements,
  Header,
  ImageSwiper,
  SocialLinks,
  Space,
  Text,
  VideoPlayer
} from '../../../components'
import { secondary } from '../../../constants'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_3'
>

type OnlineGameScreenT = {
  navigation: navigation
}

const theme = {
  Button: {
    titleStyle: {
      color: secondary,
      padding: 30
    },
    containerStyle: {
      width: s(240),
      alignSelf: 'center'
    }
  },

  colors: {
    primary: secondary
  }
}

const OnlineGameScreen = observer(({ navigation }: OnlineGameScreenT) => {
  const [images, setImages] = useState<string[]>([])

  const {
    colors: { text }
  } = useTheme()

  useEffect(() => {
    const getData = async () => {
      let response = await fetch(
        'https://s3.eu-central-1.wasabisys.com/database999/LeelaChakra/PhotoLeela/leelaPhoto.json'
      )
      setImages(await response.json())
    }
    getData()
  }, [navigation])
  const { top } = useSafeAreaInsets()
  const poster =
    'https://s3.eu-central-1.wasabisys.com/database999/Playra/AlbumMahaKumbhaMela/Our-way-of-evolution.jpg'
  const uri =
    'https://s3.eu-central-1.wasabisys.com/database999/Playra/AlbumMahaKumbhaMela/Our-way-of-evolution.mp4'

  return (
    <View style={container}>
      <ThemeProvider theme={theme}>
        <Background>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
          >
            <Header displayStatus textAlign="center" />
            <Text textStyle={centered} h={'h3'} title={I18n.t('events')} />
            <Space height={s(20)} />
            <ImageSwiper images={images} height={vs(300)} />
            <Space height={s(30)} />
            <Text textStyle={centered} h={'h3'} title={I18n.t('author')} />
            <Space height={s(20)} />
            {lang !== 'en' && (
              <View style={containerStyle}>
                <VideoPlayer paused source={{ uri }} poster={poster} />
              </View>
            )}
            <Space height={s(20)} />
            <Text
              h={'h4'}
              title={I18n.t('playra1')}
              textStyle={{ paddingHorizontal: 40 }}
            />
            <Space height={s(20)} />
            <ButtonElements
              title={I18n.t('more')}
              onPress={() => navigation.navigate('PLAYRA_SCREEN')}
            />
            <Space height={s(20)} />
            <Text
              h={'h4'}
              title={I18n.t('playra2')}
              textStyle={[centered, { paddingHorizontal: s(40) }]}
            />
            <Space height={s(20)} />
            <Text textStyle={centered} h={'h3'} title={I18n.t('contacts')} />
            <SocialLinks />
            <Space height={vs(200)} />
          </ScrollView>
        </Background>
      </ThemeProvider>
    </View>
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
  contentContainerStyle: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  centered: {
    textAlign: 'center'
  }
})
const { centered, container, containerStyle, contentContainerStyle } = styles

export { OnlineGameScreen }
{
  /* {lang !== 'en' && (
              <>
                <PricingCard
                  color={secondary}
                  title={I18n.t('onlineGame')}
                  price="₽ 1 000"
                  info={['6 игроков', 'Одна игра', '2 часа']}
                  button={{ title: ' Купить', icon: 'flight-takeoff' }}
                  containerStyle={containerStyle}
                  infoStyle={infoStyle}
                  pricingStyle={{
                    color: text
                  }}
                  onButtonPress={() =>
                    openUrl(
                      'https://securepayments.sberbank.ru/shortlink/FaDdtqXS'
                    )
                  }
                />
                <PricingCard
                  color={secondary}
                  title={I18n.t('offline')}
                  price="₽ 2 000"
                  info={['6 игроков', 'Встреча офлайн', '2 часа']}
                  infoStyle={infoStyle}
                  button={{ title: ' Купить', icon: 'flight-takeoff' }}
                  containerStyle={containerStyle}
                  pricingStyle={{
                    color: text
                  }}
                  onButtonPress={() =>
                    openUrl(
                      'https://securepayments.sberbank.ru/shortlink/iIWsaJcS'
                    )
                  }
                />
                <PricingCard
                  color={secondary}
                  title={I18n.t('onlineGame')}
                  price="₽ 6 000"
                  info={['1 игрок', 'Индивидуальная сессия', '2 часа']}
                  infoStyle={infoStyle}
                  button={{ title: ' Купить', icon: 'flight-takeoff' }}
                  containerStyle={containerStyle}
                  pricingStyle={{
                    color: text
                  }}
                  onButtonPress={() =>
                    openUrl(
                      'https://securepayments.sberbank.ru/shortlink/odk9KRop'
                    )
                  }
                />
              </>
            )} */
}
