import React, { useEffect, useState } from 'react'
import { FlatList } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import { I18n, lang } from '../../utils'
import { PlansT, RootStackParamList } from '../../types'
import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { ru } from './ru'
import { en } from './en'
import { s } from 'react-native-size-matters'

type navigation = StackNavigationProp<RootStackParamList, 'PLANS_SCREEN'>

type PlansScreenT = {
  navigation: navigation
}

const PlansScreen = ({ navigation }: PlansScreenT) => {
  const [data, setData] = useState<PlansT[]>([])

  const _keyExtractor = (obj: any) => obj.id.toString()

  useEffect(() => {
    setData(lang === 'en' ? en : ru)
  })

  return (
    <AppContainer
      onPress={goBack(navigation)}
      title={`${I18n.t('plans')}`}
      iconLeft=":heavy_multiplication_x:"
    >
      <FlatList
        style={{ paddingHorizontal: s(15) }}
        ListHeaderComponent={<Space height={50} />}
        ListFooterComponent={<Space height={300} />}
        data={data}
        renderItem={({ item }) => (
          <RenderPlanItem
            title={item.title}
            onPress={() => navigation.navigate('PLANS_DETAIL_SCREEN', item)}
          />
        )}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { PlansScreen }
