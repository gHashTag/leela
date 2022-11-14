import React, { useEffect, useState } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react-lite'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import {
  AppContainer,
  HeaderMaster,
  HistoryStep,
  Loading,
  Space,
  Text,
} from 'src/components'
import { RootStackParamList, UserT } from 'src/types'
import { RouteProp } from '@react-navigation/native'
import firestore from '@react-native-firebase/firestore'
import { getIMG } from '../helper'

type navigation = NativeStackNavigationProp<RootStackParamList, 'USER_PROFILE_SCREEN'>

type UserProfileScreenT = {
  navigation: navigation
  route: RouteProp<RootStackParamList, 'USER_PROFILE_SCREEN'>
}

export const UserProfileScreen = observer(({ navigation, route }: UserProfileScreenT) => {
  const { ownerId } = route.params
  const [data, setData] = useState({
    intention: '',
    history: [],
    avatar: '',
    plan: 0,
    fullName: '',
  })
  const [load, setLoad] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    const unsub = firestore()
      .collection('Profiles')
      .doc(ownerId)
      .onSnapshot(async snap => {
        const { avatar, intention, history, plan, firstName, lastName } =
          snap.data() as UserT
        const avaUrl = await getIMG(avatar)
        setData({
          intention: intention || '',
          history: history as any,
          avatar: avaUrl,
          plan: plan,
          fullName: `${firstName} ${lastName}`,
        })
        setLoad(false)
      })

    return unsub
  }, [])

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={':back:'}
      onPress={navigation.goBack}
      title=" "
    >
      {load ? (
        <Loading />
      ) : (
        <FlatList
          style={page.container}
          ListFooterComponent={<Space height={vs(50)} />}
          initialNumToRender={60}
          maxToRenderPerBatch={60}
          data={data.history}
          renderItem={props => (
            <View style={page.withPaddings}>
              <HistoryStep {...props} />
            </View>
          )}
          keyExtractor={(e, id) => String(id)}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <>
              <HeaderMaster
                avatar={data.avatar}
                plan={data.plan}
                fullName={data.fullName}
              />
              <View style={page.withPaddings}>
                {data.intention && (
                  <>
                    <Text h="h3" title={t('intention')} />
                    <Space height={vs(5)} />
                    <Text h="h5" title={data.intention} />
                  </>
                )}
                <Space height={vs(10)} />
                <Text h="h3" title={t('history')} />
              </View>
            </>
          )}
        />
      )}
    </AppContainer>
  )
})

const page = StyleSheet.create({
  container: {
    flex: 1,
  },
  withPaddings: {
    paddingHorizontal: s(20),
  },
})
