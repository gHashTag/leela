import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { useKeychain } from '../../../hooks'

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
} from '../../../components'
import {
  black,
  bundleVersion,
  goBack,
  openURLPolicy,
  white,
  buildVersion,
  gray,
  openURLEula
} from '../../../constants'
import { RootStackParamList } from '../../../types/types'
import { triggerHaptic } from '../../../utils/haptics'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'HELLO'
>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const styles = StyleSheet.create({
  // h6: { alignSelf: 'center' },
  textStyle: { color: gray, fontSize: 19 }
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { loading } = useKeychain()
  const { dark } = useTheme()
  const color = dark ? white : black
  const { t } = useTranslation()

  const goToSignIn = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('SIGN_IN')
  }

  const goToSignUp = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('SIGN_UP')
  }

  const goToOffline = () => {
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
      onPress={goBack}
      title=" "
      colorLeft={color}
    >
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={vs(40)} />
          <Text
            h="h5"
            title={t('hello.subtitle')}
            testID="hello-subtitle"
          />
          <Space height={vs(30)} />
          <ResumeLastGame onResume={resumeGame} />
          <Space height={vs(16)} />
          <Button
            title={t('auth.signIn')}
            onPress={goToSignIn}
            testID="hello-sign-in-button"
          />
          <Space height={vs(10)} />
          <Button
            title={t('auth.signUp')}
            onPress={goToSignUp}
            testID="hello-sign-up-button"
          />
          <Space height={vs(24)} />
          <ButtonSimple
            title={t('hello.offlineButton')}
            onPress={goToOffline}
            testID="hello-offline-button"
          />
          <Space height={vs(40)} />
          <Text
            onPress={openURLPolicy}
            style={styles.textStyle}
            title="Privacy Policy"
          />
          <Space height={s(10)} />
          <Text
            onPress={openURLEula}
            style={styles.textStyle}
            title="Terms of Use (EULA)"
          />
          <Space height={s(10)} />
          <Text
            onPress={openURLPolicy}
            style={styles.textStyle}
            title={`Version: ${bundleVersion} (${buildVersion})`}
            testID="welcome"
          />
          <Space height={vs(20)} />
        </CenterView>
      )}
    </AppContainer>
  )
}

export { Hello }
