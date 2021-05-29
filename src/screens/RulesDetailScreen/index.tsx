import React, { useEffect } from 'react'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { actionPlay, PlayButtonStore } from '../../store'
import { RootStackParamList } from '../../'
import { AppContainer, Txt, Space, ButtonPlay, YouTubePlayer } from '../../components'
import { goBack } from '../../constants'
import { StyleSheet } from 'react-native'

type navigation = StackNavigationProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>

type RulesDetailScreenT = {
  navigation: navigation
  route: route
}

const styles = StyleSheet.create({
  h3: {
    padding: 20
  }
})

const RulesDetailScreen = observer(({ navigation, route }: RulesDetailScreenT) => {
  const { title, content, videoUrl } = route.params
  const { h3 } = styles

  useEffect(() => {
    actionPlay.stop()
  }, [])

  return (
    <AppContainer
      onPress={() => {
        goBack(navigation)()
        actionPlay.stop()
      }}
      title={title}
    >
      <Space height={10} />
      {videoUrl === '' ? (
        <ButtonPlay type={PlayButtonStore.play} obj={route.params} />
      ) : (
        <YouTubePlayer uri={videoUrl} />
      )}
      <Txt h3 title={content} textStyle={h3} textAlign="left" />
      <Space height={300} />
    </AppContainer>
  )
})

export { RulesDetailScreen }
