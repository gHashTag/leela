import React, { useCallback } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import data from './indexes.json'

import { AppContainer, RenderPlanItem, Space } from '../../components'
import { goBack } from '../../constants'
import { OnlinePlayer } from '../../store'
import { PlansT, RootStackParamList } from '../../types'

type navigation = NativeStackNavigationProp<RootStackParamList, 'PLANS_SCREEN'>

type PlansScreenT = {
  navigation: navigation
}

const PlansScreen = ({ navigation }: PlansScreenT) => {
  const { t } = useTranslation()

  const _keyExtractor = (obj: number) => String(obj)

  const onPressItem = useCallback(
    (item: PlansT) => () => {
      const itemIsReported =
        OnlinePlayer.store.plan === item && !OnlinePlayer.store.isReported
      navigation.navigate('PLANS_DETAIL_SCREEN', {
        id: item,
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
          <RenderPlanItem
            title={t(`plans:plan_${item}.title`)}
            onPress={onPressItem(item)}
          />
        )}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
}

export { PlansScreen }
