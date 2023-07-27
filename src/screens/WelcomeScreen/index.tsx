import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
// import { StyleSheet } from 'react-native'
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

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'SELECT_PLAYERS_SCREEN'
>

type SelectPlayersScreenT = {
  navigation: navigation
}

const WelcomeScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const { loading } = useKeychain()
  const { t } = useTranslation()

  const _onPress = () => {
    navigation.navigate('HELLO')
  }

  return (
    <AppContainer
      enableBackgroundBottomInsets
      enableBackgroundTopInsets
      iconLeft={null}
      hidestar
    >
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={s(30)} />
          <Text h={'h1'} title={t('gameMode')} />
          <Space height={s(30)} />
          <Button title={t('online')} onPress={_onPress} />
          <Space height={vs(10)} />
          {/* <Text h={'h5'} title={t('or')} textStyle={styles.h6} />
          <Space height={vs(15)} /> */}
          {/* <Button
            title={t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          /> */}
          <Space height={vs(120)} />
        </CenterView>
      )}
    </AppContainer>
  )
})

// const styles = StyleSheet.create({
//   h6: { alignSelf: 'center' },
// })

export { WelcomeScreen }
