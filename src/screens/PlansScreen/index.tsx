import React, { useCallback, useState } from 'react'
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
  const [data] = useState<PlansT[]>(lang === 'en' ? en : ru)

  const _keyExtractor = (obj: any) => obj.id.toString()

  const onPressItem = useCallback(
    (item: PlansT) => () => {
      const itemIsReported =
        OnlinePlayer.store.plan === item.id && !OnlinePlayer.store.isReported
      navigation.navigate('PLANS_DETAIL_SCREEN', {
        ...item,
        report: itemIsReported
      })
    },
    []
  )

  return (
    <AppContainer
      onPress={goBack}
      title={`${I18n.t('plans')}`}
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
