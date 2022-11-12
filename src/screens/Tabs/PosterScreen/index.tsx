import React, { useEffect } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
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

  const { t } = useTranslation()

  return (
    <ImageBackground
      resizeMode="cover"
      source={{ uri: OnlinePlayer.store.poster.imgUrl }}
      style={img}
    >
      <ButtonWithIcon
        title={t('more')}
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
