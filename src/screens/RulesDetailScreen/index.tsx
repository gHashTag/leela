import React, { useEffect } from 'react'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { observer } from 'mobx-react-lite'
import { actionPlay } from '../../store'
import { RootStackParamList } from '../../types'
import { AppContainer, Space, Text } from '../../components'
import { goBack } from '../../constants'
import { StyleSheet } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { vs } from 'react-native-size-matters'

type navigation = NativeStackNavigationProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>

type RulesDetailScreenT = {
  navigation: navigation
  route: route
}

const styles = StyleSheet.create({
  h3: {
    padding: 20,
    letterSpacing: 0.5
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
      }}
      title={title}
      iconLeft=":heavy_multiplication_x:"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Space height={10} />
        <Text selectable h={'h7'} title={content} textStyle={h3} />
        <Space height={vs(200)} />
      </ScrollView>
    </AppContainer>
  )
})

export { RulesDetailScreen }
