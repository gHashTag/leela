import React from 'react'
import { observer } from 'mobx-react'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { s, vs } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import {
  AppContainer,
  Space,
  Button,
  Text,
  CenterView,
  IconLeela,
  Loading
} from '../../components'
import { useKeychain } from '../../hooks'
import { StyleSheet } from 'react-native'

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
    <AppContainer iconLeft={null}>
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
  h6: { alignSelf: 'center' }
})

export { WelcomeScreen }
