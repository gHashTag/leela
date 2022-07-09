import React, { useCallback, useRef, useState } from 'react'
import { StyleSheet, View, ToastAndroid, Platform, BackHandler } from 'react-native'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import {
  AppContainer,
  VideoPlayer,
  Space,
  Text,
  CreatePost,
  KeyboardContainer,
  ButtonPlay
} from '../../components'
import { ScrollView } from 'react-native-gesture-handler'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { OnlinePlayer } from '../../store'
import I18n from 'i18n-js'
import Sound from 'react-native-sound'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>

type PlansDetailScreenT = {
  navigation: navigation
  route: route
}

const PlansDetailScreen = observer(({ navigation, route }: PlansDetailScreenT) => {
  const { id, title, content, audioUrl, report, url } = route.params
  const soundRef = useRef<Sound>()
  const { h3 } = styles
  const { isReported } = OnlinePlayer.store
  const [isPlaying, setIsPaying] = useState<boolean>(false)
  const handleCross = () => {
    if (isReported) {
      navigation.goBack()
      soundRef.current?.stop()
    } else {
      Platform.OS === 'android' &&
        ToastAndroid.showWithGravityAndOffset(
          I18n.t('notReported'),
          ToastAndroid.LONG,
          ToastAndroid.BOTTOM,
          25,
          50
        )
    }
  }
  useFocusEffect(
    useCallback(() => {
      const sound = new Sound(audioUrl, undefined, () => {
        sound.play()
      })
      soundRef.current = sound
      const backhandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleCross()
        return true
      })
      return () => {
        backhandler.remove()
        soundRef.current?.stop()
      }
    }, [])
  )
  const onToggle = () => {
    if (soundRef.current?.isPlaying()) {
      soundRef.current.pause()
    } else {
      soundRef.current?.play()
    }
    setIsPaying(Boolean(soundRef.current?.isPlaying()))
  }
  return (
    <AppContainer
      onPress={handleCross}
      title={title}
      iconRight={null}
      iconLeftOpacity={isReported ? 1 : 0.4}
      iconLeft=":heavy_multiplication_x:"
      status="1x1"
    >
      <KeyboardContainer>
        <ScrollView>
          <Space height={vs(10)} />
          <ButtonPlay onPress={onToggle} isStop={!isPlaying} />
          <Space height={vs(10)} />
          <Text selectable h={'h7'} title={content} textStyle={h3} />
          {report && <CreatePost plan={id} />}
          <Space height={vs(!report ? 135 : 80)} />
        </ScrollView>
      </KeyboardContainer>
    </AppContainer>
  )
})
const styles = StyleSheet.create({
  h3: {
    padding: s(20)
  }
})
export { PlansDetailScreen }
