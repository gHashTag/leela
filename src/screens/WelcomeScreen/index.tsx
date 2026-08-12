import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { s, vs } from 'react-native-size-matters'

import {
  AppContainer,
  Button,
  ButtonSimple,
  CenterView,
  IconLeela,
  Loading,
  ResumeLastGame,
  Space,
  Text
} from '../../components'
import { useKeychain } from '../../hooks'
import { RootStackParamList } from '../../types/types'
import { triggerHaptic } from '../../utils/haptics'

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

  const navigateToAuth = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('HELLO')
  }

  const navigateToOffline = () => {
    triggerHaptic('impactLight')
    navigation.navigate('SELECT_PLAYERS_SCREEN')
  }

  const resumeGame = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
  }

  return (
    <AppContainer
      enableBackgroundBottomInsets
      enableBackgroundTopInsets
      iconLeft={null}
    >
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={s(30)} />
          <Text h={'h1'} title={t('gameMode')} />
          <Space height={s(10)} />
          <Text
            h={'h5'}
            title={t('welcome.subtitle')}
            testID="welcome-subtitle"
          />
          <Space height={s(30)} />
          <ResumeLastGame onResume={resumeGame} />
          <Space height={vs(16)} />
          <Button
            title={t('online')}
            onPress={navigateToAuth}
            testID="welcome-online-button"
          />
          <Space height={vs(10)} />
          <ButtonSimple
            title={t('welcome.offlineButton')}
            onPress={navigateToOffline}
            testID="welcome-offline-button"
          />
          <Space height={vs(80)} />
        </CenterView>
      )}
    </AppContainer>
  )
})

// const styles = StyleSheet.create({
//   h6: { alignSelf: 'center' },
// })

export { WelcomeScreen }
