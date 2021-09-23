import React, { useState, useEffect } from 'react'
import { View, SectionList } from 'react-native'
import { Auth, API, graphqlOperation } from 'aws-amplify'
import { StackNavigationProp } from '@react-navigation/stack'
import { observer } from 'mobx-react-lite'
import { ScaledSheet } from 'react-native-size-matters'
import * as Keychain from 'react-native-keychain'
import { listProfiles } from '../../../src/graphql/queries'
import { onUpdateProfile } from '../../graphql/subscriptions'
import { I18n } from '../../utils'
import { RootStackParamList, UserT } from '../../types'
import { AppContainer, Txt, Space, EmojiText, Button, HeaderMaster } from '../../components'
import { captureException } from '../../constants'
import {
  DiceStore,
  PlayerOneStore,
  PlayerTwoStore,
  PlayerThreeStore,
  PlayerFourStore,
  PlayerFiveStore,
  PlayerSixStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix,
  actionsDice
} from '../../store'

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
  const [data, updateData] = useState<UserT>({
    id: '0',
    firstName: '',
    lastName: '',
    email: '',
    plan: 68,
    avatar: ''
  })

  const fetchData = async () => {
    const credentials = await Keychain.getInternetCredentials('auth')
    if (credentials) {
      const { username } = credentials
      const obj = await API.graphql(
        graphqlOperation(listProfiles, {
          filter: {
            email: {
              eq: username
            }
          }
        })
      )
      obj && updateData(obj.data.listProfiles.items[0])
      obj && setLoading(false)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const subscriptionUpdate = API.graphql(graphqlOperation(onUpdateProfile)).subscribe({
      next: (obj: any) => updateData(obj.value.data.onUpdateProfile)
    })
    return () => {
      subscriptionUpdate.unsubscribe()
    }
  }, [navigation])

  const _renderItem = ({ item, index }: StepsT) => {
    const { id, plan, count, status } = item
    return (
      <View key={id} style={container}>
        <Txt h6 title={`${index} => `} />
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
      data: PlayerOneStore.history.slice()
    },
    {
      title: `${I18n.t('player')} 2`,
      data: PlayerTwoStore.history.slice()
    },
    {
      title: `${I18n.t('player')} 3`,
      data: PlayerThreeStore.history.slice()
    },
    {
      title: `${I18n.t('player')} 4`,
      data: PlayerFourStore.history.slice()
    },
    {
      title: `${I18n.t('player')} 5`,
      data: PlayerFiveStore.history.slice()
    },
    {
      title: `${I18n.t('player')} 6`,
      data: PlayerSixStore.history.slice()
    }
  ].slice(0, DiceStore.multi)

  const _onPress = async (): Promise<void> => {
    try {
      await Auth.signOut()
      await Keychain.resetInternetCredentials('auth')
      actionPlayerOne.resetGame()
      actionPlayerTwo.resetGame()
      actionPlayerThree.resetGame()
      actionPlayerFour.resetGame()
      actionPlayerFive.resetGame()
      actionPlayerSix.resetGame()
      actionsDice.setOnline(false)
      navigation.pop(2)
    } catch (err) {
      captureException(err.message)
    }
  }

  console.log(`data`, PlayerOneStore.history.slice())

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
            <Button
              title={I18n.t('startOver')}
              onPress={_onPress}
            />
            <Space height={300} />
          </>
        }
        stickySectionHeadersEnabled={false}
        sections={DATA}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => <Txt h1 title={DiceStore.online ? '' : title} textStyle={{ padding: 15 }} />}
      />
    </AppContainer>
  )
})



export { ProfileScreen }
