import React, { useEffect, useState } from 'react'
import { StyleSheet, ImageBackground } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { RootStackParamList } from '../..'
import { DiceStore, actionPlayerOne, actionsDice } from '../../store'
import { Button } from 'react-native-elements'
import { s } from 'react-native-size-matters'
import { H, W } from '../../constants'
import { openUrl } from '../../constants'
import { captureException } from '@sentry/minimal'
import I18n from 'i18n-js'
import { DataStore } from 'aws-amplify'
import { History, Profile } from '../../models'

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
    borderColor: '#fff',
    borderWidth: 1.5
  },
  titleStyle: {
    color: '#fff'
  }
})

interface PosterPropsT {
  imgUrl: string
  eventUrl: string
}

const PosterScreen = observer(({}: PosterScreenT) => {
  const [isLoading, setLoading] = useState(true)
  const [data, setData] = useState<PosterPropsT[]>([])

  const getPoster = async () => {
    try {
      const response = await fetch('https://s3.eu-central-1.wasabisys.com/ghashtag/LeelaChakra/poster.json')
      const json = await response.json()
      setData(json[0])
    } catch (error) {
      captureException(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getPoster()
    if (DiceStore.online) {
      actionPlayerOne.getProfile()
    }
  }, [])

  const { button, img, buttonConteiner, titleStyle } = styles

  return (
    <>
      {!isLoading ? (
        <ImageBackground resizeMode={'contain'} source={{ uri: data?.imgUrl }} style={img}>
          <Button
            title={I18n.t('more')}
            type="outline"
            onPress={() => openUrl(data?.eventUrl)}
            containerStyle={buttonConteiner}
            buttonStyle={button}
            titleStyle={titleStyle}
          />
        </ImageBackground>
      ) : null}
    </>
  )
})

export { PosterScreen }
