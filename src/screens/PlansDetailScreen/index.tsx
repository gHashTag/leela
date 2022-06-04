import React from 'react'
import { StyleSheet, View, ToastAndroid, Platform, BackHandler } from 'react-native'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import { AppContainer, VideoPlayer, Space, Text, CreatePost } from '../../components'
import { goBack } from '../../constants'
import { ScrollView } from 'react-native-gesture-handler'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { OnlinePlayer } from '../../store'
import I18n from 'i18n-js'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>

type PlansDetailScreenT = {
  navigation: navigation
  route: route
}

const styles = StyleSheet.create({
  center: {
    height: s(230),
    width: '100%',
    top: s(10),
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 10
  },
  h3: {
    padding: 20
  }
})

const PlansDetailScreen = observer(({ navigation, route }: PlansDetailScreenT) => {
  const { id, title, content, videoUrl, report } = route.params
  const { h3 } = styles
  const { isReported } = OnlinePlayer.store
  const handleCross = () => {
    isReported
      ? navigation.goBack()
      : Platform.OS === 'android' &&
        ToastAndroid.showWithGravityAndOffset(
          I18n.t('notReported'),
          ToastAndroid.LONG,
          ToastAndroid.BOTTOM,
          25,
          50
        )
  }
  useFocusEffect(() => {
    const backhandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCross()
      return true
    })
    return backhandler.remove
  })
  return (
    <AppContainer
      onPress={handleCross}
      title={title}
      iconLeftOpacity={isReported ? 1 : 0.4}
      iconLeft=":heavy_multiplication_x:"
      status="1x1"
    >
      <ScrollView>
        {videoUrl !== '' && (
          <View style={styles.center}>
            <VideoPlayer source={{ uri: videoUrl }} />
          </View>
        )}
        <Space height={s(30)} />
        <Text selectable h={'h7'} title={content} textStyle={h3} />
        {report && <CreatePost plan={id} />}
        <Space height={vs(!report ? vs(130) : vs(50))} />
      </ScrollView>
    </AppContainer>
  )
})

export { PlansDetailScreen }
