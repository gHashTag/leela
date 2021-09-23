import * as React from 'react'
import { FlatList } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../types'
import { AppContainer, RenderItem, Space } from '../../components'
import { goBack } from '../../constants'
import { ru } from './ru'
import { en } from './en'

type navigation = StackNavigationProp<RootStackParamList, 'PLANS_SCREEN'>

type PlansScreenT = {
  navigation: navigation
}

interface RulesItemT {
  item: {
    id: number
    title: string
    content: string
    url?: string
  }
}

const PlansScreen = ({ navigation }: PlansScreenT) => {
  const _renderItem = ({ item }: RulesItemT) => {
    return <RenderItem title={item.title} onPress={() => navigation.navigate('PLANS_DETAIL_SCREEN', item)} />
  }

  const _keyExtractor = (obj: any) => obj.id.toString()

  const data = lang === 'en' ? en : ru

  return (
    <AppContainer flatList onPress={goBack(navigation)} title={`${I18n.t('plans')}`}>
      <FlatList
        ListHeaderComponent={<Space height={50} />}
        ListFooterComponent={<Space height={300} />}
        data={data}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { PlansScreen }
