import React from 'react'
import { StyleSheet, View } from 'react-native'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import { AppContainer, VideoPlayer, Space, Text, CreatePost } from '../../components'
import { goBack } from '../../constants'
import { actionPlay } from '../../store'
import { ScrollView } from 'react-native-gesture-handler'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

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

  return (
    <AppContainer
      onPress={() => {
        goBack(navigation)()
        actionPlay.stop()
      }}
      title={title}
      iconLeft=":heavy_multiplication_x:"
      status="1x1"
    >
      <ScrollView>
        {videoUrl !== '' && (
          <View style={styles.center}>
            <VideoPlayer uri={videoUrl} />
          </View>
        )}
        <Space height={s(30)} />
        <Text selectable h={'h7'} title={content} textStyle={h3} />
        {report && <CreatePost plan={id} />}
        <Space height={vs(!report ? 260 : 50)} />
      </ScrollView>
    </AppContainer>
  )
})

export { PlansDetailScreen }
