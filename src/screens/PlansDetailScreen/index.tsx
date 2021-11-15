import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'
import { RootStackParamList } from '../../types'
import { AppContainer, Txt, VideoPlayer } from '../../components'
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
    position: 'absolute',
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
    top: s(220)
  }
})

const PlansDetailScreen = observer(({ navigation, route }: PlansDetailScreenT) => {
  const { title, content, videoUrl } = route.params
  const { h3 } = styles

  useEffect(() => {
    actionPlay.stop()
  }, [])

  return (
    <>
      <AppContainer
        onPress={() => {
          goBack(navigation)()
          actionPlay.stop()
        }}
        title={title}
      >
        {videoUrl !== '' && (
          <View style={styles.center}>
            <VideoPlayer uri={videoUrl} />
          </View>
        )}
        <Txt h3 title={content} textStyle={h3} textAlign="left" />
      </AppContainer>
    </>
  )
})

export { PlansDetailScreen }
