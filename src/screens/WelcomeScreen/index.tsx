import React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  AppContainer,
  Button,
  CenterView,
  IconLeela,
  Loading,
  Space,
  Text,
} from '../../components'
import { useKeychain } from '../../hooks'
import { RootStackParamList } from '../../types'
import { I18n } from '../../utils'

type navigation = NativeStackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const WelcomeScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const { loading } = useKeychain()

  const _onPress = () => {
    navigation.navigate('HELLO')
  }

  return (
    <AppContainer enableBackgroundBottomInsets enableBackgroundTopInsets iconLeft={null}>
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={s(30)} />
          <Text h={'h1'} title={I18n.t('gameMode')} />
          <Space height={s(30)} />
          <Button title={I18n.t('online')} onPress={_onPress} />
          <Space height={vs(10)} />
          <Text h={'h5'} title={I18n.t('or')} textStyle={styles.h6} />
          <Space height={vs(15)} />
          <Button
            title={I18n.t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          />
          <Space height={vs(120)} />
        </CenterView>
      )}
    </AppContainer>
  )
})

const styles = StyleSheet.create({
  h6: { alignSelf: 'center' },
})

export { WelcomeScreen }
