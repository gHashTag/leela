import React, { useEffect } from 'react'
import { StyleSheet, ImageBackground } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { RootStackParamList } from '../../types'
import { actionPlayers, OnlinePlayerStore } from '../../store'
import { Button } from 'react-native-elements'
import { s } from 'react-native-size-matters'
import { W } from '../../constants'
import { openUrl } from '../../constants'
import I18n from 'i18n-js'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type PosterScreenT = {
  navigation: navigation
}

const ratio = W / 500

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  img: {
    width: W,
    height: 1006 * ratio,
    resizeMode: 'cover',
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

const PosterScreen = observer(({ }: PosterScreenT) => {
  const { button, img, buttonConteiner } = styles

  useEffect(() => {
    actionPlayers.getPoster()
  }, [])

  return (
    <ImageBackground resizeMode={'contain'} source={{ uri: OnlinePlayerStore.poster.imgUrl }} style={img}>
      <Button
        title={I18n.t('more')}
        type="outline"
        onPress={() => openUrl(OnlinePlayerStore.poster.eventUrl)}
        containerStyle={buttonConteiner}
        buttonStyle={[button, { borderColor: OnlinePlayerStore.poster.buttonColor }]}
        titleStyle={{ color: OnlinePlayerStore.poster.buttonColor }}
      />
    </ImageBackground>
  )
})

export { PosterScreen }
