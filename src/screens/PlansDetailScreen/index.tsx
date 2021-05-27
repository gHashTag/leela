import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { RootStackParamList } from '../../'
import { AppContainer, ButtonPlay, Txt, Space } from '../../components'
import { goBack } from '../../constants'
import { actionPlay, PlayButtonStore } from '../../store'

type navigation = StackNavigationProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>

type PlansDetailScreenT = {
  navigation: navigation
  route: route
}

const styles = StyleSheet.create({
  h3: {
    padding: 20
  }
})

const PlansDetailScreen = observer(({ navigation, route }: PlansDetailScreenT) => {
  const { title, content } = route.params
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
      <ButtonPlay type={PlayButtonStore.play} obj={route.params} />
      <Txt h3 title={content} textStyle={h3} textAlign="left" />
      <Space height={300} />
    </AppContainer>
  )
})

export { PlansDetailScreen }
