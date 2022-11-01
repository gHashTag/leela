import React, { useCallback, useRef, useState } from 'react'
import { StyleSheet, ToastAndroid, Platform, BackHandler } from 'react-native'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { observer } from 'mobx-react'
import { s, vs } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import {
  AppContainer,
  Space,
  Text,
  CreatePost,
  KeyboardContainer,
  ButtonPlay,
  SelectableIOS,
  Loading
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
  const { id, title, content, report, url } = route.params
  const soundRef = useRef<Sound>()
  const { h3 } = styles
  const { isReported } = OnlinePlayer.store
  const [isPlaying, setIsPaying] = useState<boolean>(false)
  const [soundLoading, setSoundLoading] = useState<boolean>(false)

  useFocusEffect(
    useCallback(() => {
      const backhandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleCross()
        return true
      })
      return () => {
        soundRef.current?.stop()
        backhandler.remove()
      }
    }, [])
  )

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

  const onToggle = () => {
    if (!soundRef.current) {
      const sound = new Sound(url, undefined)
      soundRef.current = sound
      const interval = setInterval(() => {
        const isLoaded = soundRef.current?.isLoaded()
        setSoundLoading(!isLoaded)
        if (isLoaded) {
          soundRef.current?.play()
          setIsPaying(true)
          clearInterval(interval)
        }
      }, 400)
      return
    }
    if (soundRef.current?.isPlaying()) {
      soundRef.current.pause()
      setIsPaying(false)
    } else {
      soundRef.current?.play()
      if (soundRef.current && soundRef.current.isLoaded()) {
        setIsPaying(true)
      }
    }
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
          {soundLoading ? (
            <Loading size={s(60)} />
          ) : (
            <ButtonPlay onPress={onToggle} isStop={isPlaying} />
          )}
          <Space height={vs(10)} />
          {Platform.OS === 'ios' ? (
            <SelectableIOS h={'h7'} title={content} textStyle={h3} />
          ) : (
            <Text selectable h={'h7'} title={content} textStyle={h3} />
          )}
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
