import React, { useEffect } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import { observer } from 'mobx-react'
import { ImageBackground, StyleSheet } from 'react-native'
import { vs } from 'react-native-size-matters'

import { ButtonWithIcon } from '../../../components'
import { fuchsia, openUrl } from '../../../constants'
import { OnlinePlayer } from '../../../store'
import { RootTabParamList } from '../../../types'

type navigation = NativeStackNavigationProp<RootTabParamList, 'TAB_BOTTOM_0'>

type PosterScreenT = {
  navigation: navigation
}

const PosterScreen = observer(({}: PosterScreenT) => {
  useEffect(() => {
    OnlinePlayer.getPoster()
  }, [])

  return (
    <ImageBackground
      resizeMode="cover"
      source={{ uri: OnlinePlayer.store.poster.imgUrl }}
      style={img}
    >
      <ButtonWithIcon
        title={I18n.t('more')}
        color={fuchsia}
        viewStyle={btnMore}
        iconName="ios-chevron-forward"
        onPress={() => openUrl(OnlinePlayer.store.poster.eventUrl)}
      />
    </ImageBackground>
  )
})

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  img: {
    flex: 1,
    resizeMode: 'cover',
  },
  btnMore: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: vs(100),
  },
})

const { img, btnMore } = styles

export { PosterScreen }
