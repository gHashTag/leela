import React from 'react'

import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { vs } from 'react-native-size-matters'

import { AppContainer, SelectableIOS, Space, Text } from '../../components'
import { goBack } from '../../constants'
import { RootStackParamList } from '../../types'

type navigation = NativeStackNavigationProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>
type route = RouteProp<RootStackParamList, 'RULES_DETAIL_SCREEN'>

type RulesDetailScreenT = {
  navigation: navigation
  route: route
}

const styles = StyleSheet.create({
  h3: {
    padding: 20,
    letterSpacing: 0.5,
  },
})

const RulesDetailScreen = observer(({ route }: RulesDetailScreenT) => {
  const { title, content } = route.params
  const { h3 } = styles
  const { t } = useTranslation()
  return (
    <AppContainer
      onPress={goBack}
      title={t(title)}
      enableBackgroundBottomInsets
      iconRight={null}
      iconLeft=":heavy_multiplication_x:"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Space height={10} />
        {Platform.OS === 'ios' ? (
          <SelectableIOS h={'h7'} title={t(content)} textStyle={h3} />
        ) : (
          <Text selectable h={'h7'} title={t(content)} textStyle={h3} />
        )}
        <Space height={vs(200)} />
      </ScrollView>
    </AppContainer>
  )
})

export { RulesDetailScreen }
