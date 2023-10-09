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
  CenterView,
  IconLeela,
  Loading,
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

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'HELLO'
>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const styles = StyleSheet.create({
  h6: { alignSelf: 'center' },
  textStyle: { color: gray, fontSize: 19 }
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { loading } = useKeychain()
  const { dark } = useTheme()
  const color = dark ? white : black
  const { t } = useTranslation()

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
          <Space height={70} />
          <Text
            onPress={openURLPolicy}
            style={styles.textStyle}
            title="Privacy Policy"
          />
          <Space height={10} />
          <Text
            onPress={openURLEula}
            style={styles.textStyle}
            title="Terms of Use (EULA)"
          />
          <Space height={10} />
          <Text
            onPress={openURLPolicy}
            style={styles.textStyle}
            title={`Version: ${bundleVersion} (${buildVersion})`}
            testID="welcome"
          />
          <Space height={50} />
          <Button
            title={t('auth.signIn')}
            onPress={() => navigation.navigate('SIGN_IN')}
          />
          <Space height={10} />
          {/* <Text h={'h5'} title={t('or')} textStyle={styles.h6} /> */}
          <Space height={10} />
          <Button
            title={t('auth.signUp')}
            onPress={() => navigation.navigate('SIGN_UP')}
          />
          <Space height={10} />
          <Text h={'h5'} title={t('or')} textStyle={styles.h6} />
          <Space height={10} />
          <Button
            title={t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          />
          <Space height={vs(20)} />

          <Space height={150} />
        </CenterView>
      )}
    </AppContainer>
  )
}

export { Hello }
