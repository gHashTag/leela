import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StatusBar } from 'react-native'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'
import { ButtonVectorIcon, VideoPlayer } from '../../../components'
import { RootStackParamList } from '../../../types'

interface VideoPopupT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VIDEO_MODAL'>
  route: RouteProp<RootStackParamList, 'VIDEO_MODAL'>
}

export function VideoPopup({ navigation, route }: VideoPopupT) {
  const { uri, poster } = route.params
  function handleBack() {
    navigation.goBack()
  }
  return (
    <>
      <StatusBar backgroundColor="black" barStyle="light-content" />
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
