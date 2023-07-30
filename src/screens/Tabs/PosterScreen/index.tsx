import React from 'react'

import { BlurView } from '@react-native-community/blur'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { ImageBackground, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { ButtonWithIcon } from '../../../components'
import { openUrl } from '../../../constants'
import { RootTabParamList } from '../../../types'

type navigation = NativeStackNavigationProp<RootTabParamList, 'TAB_BOTTOM_0'>

type PosterScreenT = {
  navigation: navigation
}

const PosterScreen = observer(({}: PosterScreenT) => {
  const buttonColor = '#AA6100'
  const imgUrl = './poster.jpg'
  const eventUrl = 'https://t.me/playom'

  const { t } = useTranslation()

  return (
    <ImageBackground
      resizeMode="cover"
      source={require(imgUrl)}
      style={styles.img}
    >
      <View style={styles.btnMoreContainer}>
        <BlurView
          blurType={'light'}
          blurAmount={10}
          style={styles.blurBackground}
        />
        <ButtonWithIcon
          title={t('assign')}
          color={buttonColor || '#AA6100'}
          h="h6"
          viewStyle={styles.btnMore}
          onPress={() => openUrl(eventUrl)}
        />
      </View>
    </ImageBackground>
  )
})

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center'
  },
  img: {
    flex: 1,
    resizeMode: 'cover'
  },
  btnMore: {
    margin: s(5)
  },
  btnMoreContainer: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: s(10),
    bottom: vs(82),
    overflow: 'hidden'
  },
  blurBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    opacity: 0.7,
    borderRadius: s(10),
    overflow: 'hidden'
  }
})

export { PosterScreen }
