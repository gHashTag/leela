import React, { useEffect, useState } from 'react'
import { StyleSheet, Linking, ScrollView, View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTheme } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { PricingCard, Icon, ThemeProvider } from 'react-native-elements'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../types'
import {
  Background,
  ButtonElements,
  ImageSwiper,
  Row,
  Space,
  Text,
  YouTubePlayer
} from '../../components'
import { secondary } from '../../constants'

type navigation = StackNavigationProp<RootStackParamList, 'PROFILE_SCREEN'>

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
      width: s(250),
      alignSelf: 'center'
    }
  },

  colors: {
    primary: secondary
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  containerStyle: {
    width: s(300),
    backgroundColor: 'transparent',
    alignSelf: 'center'
  },
  infoStyle: {
    fontSize: s(14)
  },
  contentContainerStyle: { flexGrow: 1, justifyContent: 'center' }
})

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

  const openUrl = async (url: string) => {
    await Linking.openURL(url)
  }
  // console.log(images[64]) // 64, 59
  const { container, containerStyle, infoStyle, contentContainerStyle } = styles

  return (
    <View style={container}>
      <ThemeProvider theme={theme}>
        <Background>
          <ScrollView contentContainerStyle={contentContainerStyle}>
            <Space height={s(10)} />
            <Text textStyle={{ textAlign: 'center' }} h={'h3'} title={I18n.t('events')} />
            <Space height={s(20)} />
            <ImageSwiper images={images} height={vs(300)} />
            <Space height={s(30)} />
            <Text textStyle={{ textAlign: 'center' }} h={'h3'} title={I18n.t('author')} />
            <Space height={s(20)} />
            {lang !== 'en' && <YouTubePlayer uri="TDT--lnKSBU" />}
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
              textStyle={{ paddingHorizontal: 40 }}
            />
            <Space height={s(20)} />
            {/* {lang !== 'en' && (
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
                    openUrl('https://securepayments.sberbank.ru/shortlink/FaDdtqXS')
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
                    openUrl('https://securepayments.sberbank.ru/shortlink/iIWsaJcS')
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
                    openUrl('https://securepayments.sberbank.ru/shortlink/odk9KRop')
                  }
                />
              </>
            )} */}

            <Space height={s(20)} />
            <Text
              textStyle={{ textAlign: 'center' }}
              h={'h3'}
              title={I18n.t('contacts')}
            />
            <Row>
              <Icon
                name="instagram"
                type="font-awesome"
                color={secondary}
                size={40}
                containerStyle={{ margin: 20 }}
                onPress={() => openUrl('https://instagram.com/leela.chakra')}
              />
              <Icon
                name="facebook"
                type="font-awesome"
                color={secondary}
                size={40}
                containerStyle={{ margin: 20 }}
                onPress={() => openUrl('https://www.facebook.com/leelachakraapp')}
              />
              <Icon
                name="vk"
                type="font-awesome"
                color={secondary}
                size={40}
                containerStyle={{ margin: 20 }}
                onPress={() => openUrl('https://vk.com/leela.chakra')}
              />
              <Icon
                name="telegram"
                type="font-awesome"
                color={secondary}
                size={40}
                containerStyle={{ margin: 20 }}
                onPress={() => openUrl('https://t.me/leelachakraapp')}
              />
            </Row>
            <Space height={vs(200)} />
          </ScrollView>
        </Background>
      </ThemeProvider>
    </View>
  )
})

export { OnlineGameScreen }
