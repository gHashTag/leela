import React from 'react'

import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StatusBar, useColorScheme } from 'react-native'
import { StyleSheet, View } from 'react-native'
import Orientation from 'react-native-orientation-locker'
import { s } from 'react-native-size-matters'
import SystemNavigationBar from 'react-native-system-navigation-bar'

import { ButtonVectorIcon, VideoPlayer } from '../../../components'
import { black, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

interface VideoPopupT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VIDEO_SCREEN'>
  route: RouteProp<RootStackParamList, 'VIDEO_SCREEN'>
}

export function VideoPopup({ navigation, route }: VideoPopupT) {
  const { uri, poster } = route.params
  function handleBack() {
    navigation.goBack()
    Orientation.lockToPortrait()
  }
  const isDark = useColorScheme() === 'dark'
  useFocusEffect(() => {
    Orientation.unlockAllOrientations()
    SystemNavigationBar.setNavigationColor('black', 'light')
    return () => {
      SystemNavigationBar.setNavigationColor(
        isDark ? black : white,
        !isDark ? 'light' : 'dark',
      )
    }
  })
  return (
    <>
      <StatusBar hidden backgroundColor="black" barStyle="light-content" />
      <View style={page.transpView}>
        <VideoPlayer source={{ uri }} poster={poster} />
        <ButtonVectorIcon
          onPress={handleBack}
          viewStyle={page.btnS}
          name="angle-double-left"
          size={s(40)}
        />
      </View>
    </>
  )
}

const page = StyleSheet.create({
  transpView: {
    flex: 1,
  },
  btnS: {
    position: 'absolute',
    left: s(10),
    top: s(10),
    zIndex: 10,
  },
})
