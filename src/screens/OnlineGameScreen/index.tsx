import React, { useEffect, useState } from 'react'
import { StyleSheet, Linking, ScrollView, View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTheme } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'
import { PricingCard, Icon, Button, ThemeProvider } from 'react-native-elements'
import { SliderBox } from 'react-native-image-slider-box'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../'
import { Background, ButtonElements, Row, Space, Txt, YouTubePlayer } from '../../components'
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
  }
})

const OnlineGameScreen = observer(({ navigation }: OnlineGameScreenT) => {
  const [images, setImages] = useState<string[]>([])

  const {
    colors: { text }
  } = useTheme()

  useEffect(() => {
    const getData = async () => {
      let response = await fetch(
        'https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/PhotoLeela/leelaPhoto.json'
      )
      setImages(await response.json())
    }
    getData()
  }, [navigation])

  const openUrl = async (url: string) => {
    await Linking.openURL(url)
  }
  const { container, containerStyle, infoStyle } = styles
  return (
    <View style={container}>
      <ThemeProvider theme={theme}>
        <Background>
          <View>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
              <Space height={s(30)} />
              <Txt h1 title={I18n.t('events')} />
              <Space height={s(20)} />
              <SliderBox images={images} sliderBoxHeight={300} />
              <Space height={s(30)} />
              <Space height={s(20)} />
              <Txt h1 title={I18n.t('author')} />
              <Space height={s(20)} />
              <YouTubePlayer play uri="TDT--lnKSBU" />
              <Space height={s(20)} />
              <Txt h2 title={I18n.t('playra1')} textStyle={{ paddingHorizontal: 40 }} textAlign="center" />
              <Space height={s(20)} />
              <ButtonElements title={I18n.t('more')} onPress={() => navigation.navigate('PLAYRA_SCREEN')} />
              <Space height={s(20)} />
              <Txt h2 title={I18n.t('playra2')} textStyle={{ paddingHorizontal: 40 }} />
              <Space height={s(20)} />
              {lang !== 'en' && (
                <>
                  <PricingCard
                    color={secondary}
                    title={I18n.t('onlineGame')}
                    price="₽2500"
                    info={['6 игроков', 'Одна игра', '2 часа']}
                    button={{ title: ' Купить', icon: 'flight-takeoff' }}
                    containerStyle={containerStyle}
                    infoStyle={infoStyle}
                    pricingStyle={{
                      color: text
                    }}
                    onButtonPress={() => openUrl('https://securepayments.sberbank.ru/shortlink/YqFfV2Pw')}
                  />
                  <PricingCard
                    color={secondary}
                    title={I18n.t('offline')}
                    price="₽5000"
                    info={['6 игроков', 'Встреча офлайн', '2 часа']}
                    infoStyle={infoStyle}
                    button={{ title: ' Купить', icon: 'flight-takeoff' }}
                    containerStyle={containerStyle}
                    onButtonPress={() => openUrl('https://securepayments.sberbank.ru/shortlink/RqZH8Pjq')}
                  />
                  <PricingCard
                    color={secondary}
                    title={I18n.t('onlineGame')}
                    price="₽30000"
                    info={['1 игрок', 'Индивидуальная сессия', '2 часа']}
                    infoStyle={infoStyle}
                    button={{ title: ' Купить', icon: 'flight-takeoff' }}
                    containerStyle={containerStyle}
                    onButtonPress={() => openUrl('https://securepayments.sberbank.ru/shortlink/RqZH8Pjq')}
                  />
                </>
              )}

              <Space height={s(20)} />
              <Txt h1 title={I18n.t('contacts')} />
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

              <Space height={s(400)} />
            </ScrollView>
          </View>
        </Background>
      </ThemeProvider>
    </View>
  )
})

export { OnlineGameScreen }
