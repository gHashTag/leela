import React, { useEffect, useState } from 'react'
import { FlatList } from 'react-native'
import { I18n, lang } from '../../utils'
import { PlansT, RootStackParamList } from '../../types'
import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { ru } from './ru'
import { en } from './en'
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { OnlinePlayer } from '../../store'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLANS_SCREEN'>

type PlansScreenT = {
  navigation: navigation
}

const PlansScreen = ({ navigation }: PlansScreenT) => {
  const [data, setData] = useState<PlansT[]>([])

  const _keyExtractor = (obj: any) => obj.id.toString()

  useEffect(() => {
    setData(lang === 'en' ? en : ru)
  })

  const getIsReportItem = (id: number) => {
    return OnlinePlayer.store.plan === id && !OnlinePlayer.store.isReported
  }

  return (
    <AppContainer
      onPress={goBack}
      title={`${I18n.t('plans')}`}
      iconRight={null}
      iconLeft=":heavy_multiplication_x:"
    >
      <FlatList
        style={{ paddingHorizontal: s(15) }}
        ListHeaderComponent={<Space height={vs(15)} />}
        ListFooterComponent={<Space height={vs(165)} />}
        data={data}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RenderPlanItem
            title={item.title}
            onPress={() =>
              navigation.navigate('PLANS_DETAIL_SCREEN', {
                ...item,
                report: getIsReportItem(item.id)
              })
            }
          />
        )}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { PlansScreen }
