import * as React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import list from './list.json'

import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { RootStackParamList } from '../../types/types'

type navigation = NativeStackNavigationProp<RootStackParamList, 'RULES_SCREEN'>

type RulesScreenT = {
  navigation: navigation
}

interface RulesItemT {
  item: {
    title: string
    content: string
  }
}

const RulesScreen = ({ navigation }: RulesScreenT) => {
  const { t } = useTranslation()

  const _renderItem = ({ item }: RulesItemT) => {
    return (
      <RenderPlanItem
        title={t(item.title)}
        onPress={() => navigation.navigate('RULES_DETAIL_SCREEN', item)}
      />
    )
  }

  const _keyExtractor = (obj: any, index: number) => String(index)

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
        data={list}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { RulesScreen }
