import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StatusBar, useColorScheme } from 'react-native'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'
import { ButtonVectorIcon, VideoPlayer } from '../../../components'
import { RootStackParamList } from '../../../types'
import Orientation from 'react-native-orientation-locker'
import SystemNavigationBar from 'react-native-system-navigation-bar'
import { black, white } from '../../../constants'

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
  const scheme = useColorScheme()
  useFocusEffect(() => {
    Orientation.unlockAllOrientations()
    SystemNavigationBar.setNavigationColor('black', false)
    return () => {
      SystemNavigationBar.setNavigationColor(
        scheme === 'dark' ? black : white,
        scheme !== 'dark' ? false : true
      )
      //Orientation.lockToPortrait()
    }
  })
  return (
    <>
      <StatusBar hidden backgroundColor="black" barStyle="light-content" />
      <View style={transpView}>
        <VideoPlayer source={{ uri }} poster={poster} />
        <ButtonVectorIcon
          onPress={handleBack}
          viewStyle={btnS}
          name="angle-double-left"
          size={s(40)}
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  transpView: {
    flex: 1
  },
  btnS: {
    position: 'absolute',
    left: s(10),
    top: s(10),
    zIndex: 10
  }
})

const { transpView, btnS } = styles
