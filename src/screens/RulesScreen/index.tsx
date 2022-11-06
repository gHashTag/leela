import * as React from 'react'
import { FlatList } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../types'
import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { ru } from './ru'
import { en } from './en'
import { s, vs } from 'react-native-size-matters'

type navigation = NativeStackNavigationProp<RootStackParamList, 'RULES_SCREEN'>

type RulesScreenT = {
  navigation: navigation
}

interface RulesItemT {
  item: {
    id: number
    title: string
    content: string
    url: string
    videoUrl: string
  }
}

const RulesScreen = ({ navigation }: RulesScreenT) => {
  const _renderItem = ({ item }: RulesItemT) => {
    return (
      <RenderPlanItem
        title={item.title}
        onPress={() => navigation.navigate('RULES_DETAIL_SCREEN', item)}
      />
    )
  }

  const _keyExtractor = (obj: any) => obj.id.toString()

  const data = lang === 'en' ? en : ru

  return (
    <AppContainer
      onPress={goBack}
      enableBackgroundBottomInsets
      title={`${I18n.t('rules')}`}
      iconRight={null}
      iconLeft=":heavy_multiplication_x:"
    >
      <FlatList
        style={{ paddingHorizontal: s(15) }}
        ListHeaderComponent={<Space height={vs(50)} />}
        data={data}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { RulesScreen }
