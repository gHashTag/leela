import React, { useState, useEffect } from 'react'
import { View, SectionList } from 'react-native'
import { DataStore } from 'aws-amplify'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer } from 'mobx-react-lite'
import { ScaledSheet } from 'react-native-size-matters'
import * as Keychain from 'react-native-keychain'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { I18n } from '../../utils'
import { RootStackParamList, UserT, HistoryT } from '../../types'
import { AppContainer, Txt, Space, EmojiText, Button, HeaderMaster } from '../../components'
import { captureException } from '../../constants'
import {
  DiceStore,
  actionPlayerOne,
  PlayerOneStore,
  PlayerTwoStore,
  PlayerThreeStore,
  PlayerFourStore,
  PlayerFiveStore,
  PlayerSixStore
} from '../../store'
import { Profile } from '../../models'
import { _onPressReset } from '../helper'

type navigation = StackNavigationProp<RootStackParamList, 'PROFILE_SCREEN'>

type ProfileScreenT = {
  navigation: navigation
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 10
  }
})

interface StepsT {
  item: {
    id: string
    plan: number
    count: number
    status: string
  }
  index: number
}

const icon = (status: string) => {
  switch (status) {
    case 'snake':
      return ':snake:'
      break
    case 'arrow':
      return ':bow_and_arrow:'
      break
    case 'cube':
      return ':game_die:'
      break
    case 'start':
      return ':sun_with_face:'
      break
    case 'liberation':
      return ':game_die:'
      break
    default:
      return 'null'
      break
  }
}

const ProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const [loading, setLoading] = useState<boolean>(true)
  const [data, updateProfile] = useState<UserT>({
    id: '0',
    firstName: '',
    lastName: '',
    email: '',
    plan: 68,
    avatar: ''
  })

  const [dataHis, updateHistory] = useState<HistoryT>({
    count: 1,
    id: '0',
    plan: 68,
    status: ''
  })

  const fetchData = async () => {
    const credentials = await Keychain.getInternetCredentials('auth')
    if (credentials) {
      const { username } = credentials
      // const arrHistory = await API.graphql(graphqlOperation(listHistories))
      const arrProfile = await DataStore.query(Profile, c => c.email('eq', username))
      arrProfile && updateProfile(arrProfile[0])
      setLoading(false)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const subscription = DataStore.observe(Profile).subscribe(() => fetchData())
    return () => {
      subscription.unsubscribe()
    }
  }, [navigation])

  const _renderItem = ({ item }: StepsT) => {
    const { id, plan, count, status } = item
    return (
      <View key={id} style={container}>
        {/* <Txt h6 title={`${index} => `} /> */}
        <Space width={0} />
        {status === 'cube' && (
          <>
            <EmojiText name={icon('cube')} />
            <Space width={5} />
            <Txt h6 title={`${count} `} />
          </>
        )}
        {status !== 'cube' && (
          <>
            <EmojiText name={icon('cube')} />
            <Space width={5} />
            <Txt h6 title={`${count} => `} />
            <EmojiText name={icon(status)} />
          </>
        )}

        <Txt h6 title={`=> ${I18n.t('plan')} ${plan}`} />
      </View>
    )
  }

  const { container } = styles

  const _keyExtractor = (obj: any) => obj.id.toString()

  const DATA = [
    {
      title: `${I18n.t('player')} 1`,
      data: PlayerOneStore.history.slice().reverse()
    },
    {
      title: `${I18n.t('player')} 2`,
      data: PlayerTwoStore.history.slice().reverse()
    },
    {
      title: `${I18n.t('player')} 3`,
      data: PlayerThreeStore.history.slice().reverse()
    },
    {
      title: `${I18n.t('player')} 4`,
      data: PlayerFourStore.history.slice().reverse()
    },
    {
      title: `${I18n.t('player')} 5`,
      data: PlayerFiveStore.history.slice().reverse()
    },
    {
      title: `${I18n.t('player')} 6`,
      data: PlayerSixStore.history.slice().reverse()
    }
  ].slice(0, DiceStore.multi)

  const _onPressSignOut = async (): Promise<void> => {
    try {
      //await Auth.signOut()
      await Keychain.resetInternetCredentials('auth')
      await AsyncStorage.clear()
      actionPlayerOne.resetGame()
      navigation.pop(3)
    } catch (err) {
      captureException(err)
    }
  }

  const onlineData = [
    {
      title: `${I18n.t('player')} 1`,
      data: dataHis
    }
  ]

  const arrayData = !DiceStore.online ? onlineData : DATA

  return (
    <AppContainer flatList iconLeft={null} title={I18n.t('history')} textAlign="center" loading={loading}>
      <SectionList
        ListHeaderComponent={
          <>
            {/* <Txt h3 title={`Подписка: ${subscriptionActive.toString()}`} /> */}
            {DiceStore.online && (
              <HeaderMaster user={data} onPress={() => navigation.navigate('USER_EDIT', data)} loading={loading} />
            )}
            {/* <Txt h3 title={DiceStore.online.toString()} /> */}
            <Space height={10} />
          </>
        }
        ListFooterComponent={
          <>
            <Space height={70} />
            <Button title={I18n.t('startOver')} onPress={() => _onPressReset(navigation)} />
            <Space height={20} />
            {DiceStore.online && <Button title={I18n.t('signOut')} onPress={_onPressSignOut} />}
            <Space height={300} />
          </>
        }
        stickySectionHeadersEnabled={false}
        sections={arrayData}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => (
          <Txt h1 title={DiceStore.online ? '' : title} textStyle={{ padding: 15 }} />
        )}
      />
    </AppContainer>
  )
})

export { ProfileScreen }
