import * as React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { lang } from 'src/i18n'

import { en } from './en'
import { ru } from './ru'

import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { RootStackParamList } from '../../types'

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
  const { t } = useTranslation()

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
      title={`${t('rules')}`}
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
