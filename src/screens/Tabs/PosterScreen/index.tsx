import React, { useEffect } from 'react'
import { StyleSheet, ImageBackground } from 'react-native'
import { observer } from 'mobx-react-lite'
import { RootStackParamList, RootTabParamList } from '../../../types'
import { OnlinePlayer } from '../../../store'
import { Button } from 'react-native-elements'
import { s } from 'react-native-size-matters'
import { W } from '../../../constants'
import { openUrl } from '../../../constants'
import I18n from 'i18n-js'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type navigation = NativeStackNavigationProp<RootTabParamList, 'TAB_BOTTOM_0'>

type PosterScreenT = {
  navigation: navigation
}

const ratio = W / 500

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  img: {
    width: W,
    height: 1006 * ratio,
    resizeMode: 'cover'
  },
  buttonConteiner: {
    flex: 1,
    justifyContent: 'flex-end',
    bottom: 190,
    width: s(150),
    alignSelf: 'center'
  },
  button: {
    borderWidth: 1.5
  }
})

interface PosterPropsT {
  imgUrl: string
  eventUrl: string
}

const PosterScreen = observer(({}: PosterPropsT) => {
  const { button, img, buttonConteiner } = styles

  useEffect(() => {
    OnlinePlayer.getPoster()
  }, [])

  return (
    <ImageBackground
      resizeMode={'contain'}
      source={{ uri: OnlinePlayer.store.poster.imgUrl }}
      style={img}
    >
      <Button
        title={I18n.t('more')}
        type="outline"
        onPress={() => openUrl(OnlinePlayer.store.poster.eventUrl)}
        containerStyle={buttonConteiner}
        buttonStyle={[
          button,
          { borderColor: OnlinePlayer.store.poster.buttonColor }
        ]}
        titleStyle={{ color: OnlinePlayer.store.poster.buttonColor }}
      />
    </ImageBackground>
  )
})

export { PosterScreen }
