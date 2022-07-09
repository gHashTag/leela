import React from 'react'
import { View, SectionList } from 'react-native'
import { observer } from 'mobx-react-lite'
import { s, ScaledSheet } from 'react-native-size-matters'

import { I18n } from '../../../utils'
import { RootTabParamList, RootStackParamList } from '../../../types'
import {
  AppContainer,
  Text,
  Space,
  EmojiText,
  Button,
  HeaderMaster,
  Spin,
  CenterView
} from '../../../components'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../../store'
import { nanoid } from 'nanoid/non-secure'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_1'
>

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
    createDate: number
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
    case 'arrow':
      return ':bow_and_arrow:'
    case 'cube':
      return ':game_die:'
    case 'start':
      return ':sun_with_face:'
    case 'liberation':
      return ':game_die:'
    default:
      return 'null'
  }
}

const ProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const _renderItem = ({ item }: StepsT) => {
    const { plan, count, status } = item
    return (
      <View style={container}>
        <Space width={0} />
        {status === 'cube' && (
          <>
            <EmojiText name={icon('cube')} />
            <Space width={5} />
            <Text h={'h5'} title={`${count} `} />
          </>
        )}
        {status !== 'cube' && (
          <>
            <EmojiText name={icon('cube')} />
            <Space width={5} />
            <Text h={'h5'} title={`${count} => `} />
            <EmojiText name={icon(status)} />
          </>
        )}
        <Text h={'h5'} title={`=> ${I18n.t('plan')} ${plan}`} />
      </View>
    )
  }

  const { container } = styles

  const _keyExtractor = () => nanoid(7)

  const DATA = !DiceStore.online
    ? [
        {
          title: `${I18n.t('player')} 1`,
          data: OfflinePlayers.store.histories[0].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 2`,
          data: OfflinePlayers.store.histories[1].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 3`,
          data: OfflinePlayers.store.histories[2].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 4`,
          data: OfflinePlayers.store.histories[3].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 5`,
          data: OfflinePlayers.store.histories[4].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 6`,
          data: OfflinePlayers.store.histories[5].slice().reverse()
        }
      ].slice(0, DiceStore.multi)
    : [
        {
          title: '',
          data: OnlinePlayer.store.history.slice().reverse()
        }
      ].slice()

  const onPressAva = async () => {
    OnlinePlayer.uploadImage()
  }

  return (
    <AppContainer displayStatus title={I18n.t('history')} textAlign="center">
      <CenterView>
        {OnlinePlayer.store.loadingProf && DiceStore.online ? (
          <Spin centered />
        ) : (
          <SectionList
            style={{ paddingHorizontal: s(10) }}
            ListHeaderComponent={
              <>
                {/* <Txt h3 title={`Подписка: ${subscriptionActive.toString()}`} /> */}
                {DiceStore.online && (
                  <HeaderMaster
                    onPress={() =>
                      navigation.navigate('USER_EDIT', OnlinePlayer.store.profile)
                    }
                    onPressAva={onPressAva}
                  />
                )}
                <Space height={10} />
              </>
            }
            ListFooterComponent={
              <>
                <Space height={70} />
                <Button
                  title={I18n.t('startOver')}
                  onPress={
                    DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
                  }
                />
                <Space height={20} />
                {DiceStore.online && (
                  <>
                    <Button title={I18n.t('signOut')} onPress={OnlinePlayer.SignOut} />
                    <Space height={20} />
                  </>
                )}
                <Space height={200} />
              </>
            }
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            stickySectionHeadersEnabled={false}
            sections={DATA}
            renderItem={_renderItem}
            keyExtractor={_keyExtractor}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <Text h={'h3'} title={title} textStyle={{ padding: 15, marginTop: 10 }} />
              ) : (
                <Space height={20} />
              )
            }
          />
        )}
      </CenterView>
    </AppContainer>
  )
})

export { ProfileScreen }
