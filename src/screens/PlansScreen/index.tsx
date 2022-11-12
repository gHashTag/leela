import React, { useCallback, useState } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { lang } from 'src/i18n'

import { en } from './en'
import { ru } from './ru'

import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { OnlinePlayer } from '../../store'
import { PlansT, RootStackParamList } from '../../types'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLANS_SCREEN'>

type PlansScreenT = {
  navigation: navigation
}

const PlansScreen = ({ navigation }: PlansScreenT) => {
  const [data] = useState<PlansT[]>(lang === 'en' ? en : ru)
  const { t } = useTranslation()

  const _keyExtractor = (obj: any) => obj.id.toString()

  const onPressItem = useCallback(
    (item: PlansT) => () => {
      const itemIsReported =
        OnlinePlayer.store.plan === item.id && !OnlinePlayer.store.isReported
      navigation.navigate('PLANS_DETAIL_SCREEN', {
        ...item,
        report: itemIsReported,
      })
    },
    [navigation],
  )

  return (
    <AppContainer
      onPress={goBack}
      title={`${t('plans')}`}
      enableBackgroundBottomInsets
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
          <RenderPlanItem title={item.title} onPress={onPressItem(item)} />
        )}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { PlansScreen }
