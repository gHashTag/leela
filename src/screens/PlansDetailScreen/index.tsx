import React, { useEffect } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import { AppContainer, TextCopy, VideoPlayer, Space, CreatePost } from '../../components'
import { goBack } from '../../constants'
import { actionPlay } from '../../store'

type navigation = StackNavigationProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>
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
    padding: 20,
    textAlign: 'left'
  }
})

const PlansDetailScreen = observer(({ navigation, route }: PlansDetailScreenT) => {
  const { id, title, content, videoUrl, report } = route.params
  const { h3 } = styles

  useEffect(() => {
    actionPlay.stop()
  }, [])

  return <AppContainer
    onPress={() => {
      goBack(navigation)()
      actionPlay.stop()
    }}
    title={title}
    iconLeft=":heavy_multiplication_x:"
    status="1x1"
  >
    {videoUrl !== '' && (
      <View style={styles.center}>
        <VideoPlayer uri={videoUrl} />
      </View>
    )}
    <Space height={s(30)} />
    <TextCopy h3 title={content} textStyle={h3} />
    {!report &&
      <CreatePost plan={id} />
    }
    <Space height={vs(report ? 260 : 200)} />
  </AppContainer>
})

export { PlansDetailScreen }
//<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? "padding" : 'height'}>
