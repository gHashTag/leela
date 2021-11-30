import React, { useEffect } from 'react'
import { View, SectionList } from 'react-native'
import { DataStore, Predicates } from 'aws-amplify'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer } from 'mobx-react-lite'
import { ScaledSheet } from 'react-native-size-matters'
import * as Keychain from 'react-native-keychain'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
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
import { History, Profile } from '../../models'
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
    actionPlayerOne.getProfile()
    actionPlayerOne.getHistory()
    const subscription = DataStore.observe(Profile).subscribe(() => actionPlayerOne.getProfile())
    const subscriptionHistory = DataStore.observe(History).subscribe(() => actionPlayerOne.getHistory())
    return () => {
      subscription.unsubscribe()
      subscriptionHistory.unsubscribe()
    }
  }, [navigation])

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
      await Keychain.resetInternetCredentials('auth')
      await AsyncStorage.clear()
      actionPlayerOne.resetGame()
      navigation.popToTop()
    } catch (err) {
      captureException(err)
    }
  }

  const onPressAva = async () => {
    actionPlayerOne.uploadImage()
  }

  return (
    <AppContainer flatList iconLeft={null} title={I18n.t('history')} textAlign="center">
      <SectionList
        ListHeaderComponent={
          <>
            {/* <Txt h3 title={`Подписка: ${subscriptionActive.toString()}`} /> */}
            {DiceStore.online && (
              <HeaderMaster
                user={PlayerOneStore.profile}
                avatar={PlayerOneStore.avatar}
                onPress={() => navigation.navigate('USER_EDIT', PlayerOneStore.profile)}
                onPressAva={onPressAva}
              />
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
        sections={DATA}
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
