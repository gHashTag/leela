import React, { useEffect } from 'react'
import { View, SectionList } from 'react-native'
import { DataStore } from 'aws-amplify'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer } from 'mobx-react-lite'
import { ScaledSheet } from 'react-native-size-matters'
import * as Keychain from 'react-native-keychain'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import { AppContainer, Txt, Space, EmojiText, Button, HeaderMaster, Spin } from '../../components'
import { captureException } from '../../constants'
import {
  DiceStore,
  actionPlayers,
  PlayersStore,
  OnlinePlayerStore,
  OnlineOtherPlayers,
} from '../../store'
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

  useEffect(() => {
    if (!OnlinePlayerStore.profile.id)
      actionPlayers.getProfile()
  }, [])

  const _renderItem = ({ item }: StepsT) => {
    const { id, plan, count, status } = item
    return (
      <View key={id} style={container}>
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

  const _keyExtractor = (obj: any) => obj.id

  const DATA = !DiceStore.online ? [
    {
      title: `${I18n.t('player')} 1`,
      data: PlayersStore.histories[0].slice().reverse()
    },
    {
      title: `${I18n.t('player')} 2`,
      data: PlayersStore.histories[1].slice().reverse()
    },
    {
      title: `${I18n.t('player')} 3`,
      data: PlayersStore.histories[2].slice().reverse()
    },
    {
      title: `${I18n.t('player')} 4`,
      data: PlayersStore.histories[3].slice().reverse()
    },
    {
      title: `${I18n.t('player')} 5`,
      data: PlayersStore.histories[4].slice().reverse()
    },
    {
      title: `${I18n.t('player')} 6`,
      data: PlayersStore.histories[5].slice().reverse()
    }
  ].slice(0, DiceStore.multi) 
  : [
    {
      title: '',
      data: OnlinePlayerStore.histories.slice().reverse()
    }
  ].slice() 

  const _onPressSignOut = async (): Promise<void> => {
    try {
      actionPlayers.SignOut()
      await Keychain.resetInternetCredentials('auth')
      await AsyncStorage.clear()
      await DataStore.clear()
      navigation.popToTop()
    } catch (err) {
      captureException(err)
    }
  }

  const onPressAva = async () => {
    actionPlayers.uploadImage()
  }

  return (
    <AppContainer flatList iconLeft={null} title={I18n.t('history')} textAlign="center">
      {OnlinePlayerStore.loading && DiceStore.online ? 
      <Spin />
      :
      <SectionList
        ListHeaderComponent={
          <>
            {/* <Txt h3 title={`Подписка: ${subscriptionActive.toString()}`} /> */}
            {DiceStore.online && 
              <HeaderMaster
                user={OnlinePlayerStore.profile}
                plan={OnlinePlayerStore.plan}
                avatar={OnlinePlayerStore.avatar}
                onPress={() => navigation.navigate('USER_EDIT', OnlinePlayerStore.profile)}
                onPressAva={onPressAva}
              />
            }
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
        sections={DATA}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => 
        title ? <Txt h1 title={title} textStyle={{ padding: 15, marginTop: 10 }} /> : <Space height={20} />
        }
      />}
    </AppContainer>
  )
})

export { ProfileScreen }
