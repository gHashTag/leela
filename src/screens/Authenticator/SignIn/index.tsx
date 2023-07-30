import React, { ReactElement } from 'react'

import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FieldValues, FormProvider, SubmitErrorHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { useSignIn } from './useSignIn'

import {
  AppContainer,
  Button,
  ButtonLink,
  Input,
  KeyboardContainer,
  Loading,
  Space,
  TextError
} from '../../../components'
import {
  H,
  W,
  black,
  captureException,
  goBack,
  white
} from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_IN'
>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const SignIn = ({ navigation }: SignUpT): ReactElement => {
  const { onSubmit, methods, error, loading, userInfo } = useSignIn()
  const { t } = useTranslation()

  const onError: SubmitErrorHandler<FieldValues> = (errors) => {
    captureException(errors, 'SignIn')
  }

  const handleForgot = () => {
    navigation.navigate('FORGOT', { email: userInfo.current })
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return loading ? (
    <Loading />
  ) : (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={':back:'}
      onPress={goBack}
      title=" "
      colorLeft={color}
    >
      <KeyboardContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Space height={H / 5} />
          <View style={KAV}>
            <FormProvider {...methods}>
              <Input
                name="email"
                placeholder="E-mail"
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Input
                name="password"
                placeholder={t('auth.password')}
                secureTextEntry
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Space height={s(10)} />
              {error !== t('auth.forgotPassword') ? (
                <TextError title={error} textStyle={textStyle} />
              ) : (
                <ButtonLink
                  title={error}
                  onPress={handleForgot}
                  textStyle={textStyle}
                />
              )}
              <Space height={vs(15)} />
              <Button
                title={t('auth.signIn')}
                onPress={methods.handleSubmit(onSubmit, onError)}
              />
            </FormProvider>
          </View>
          <Space height={vs(10)} />
        </ScrollView>
      </KeyboardContainer>
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  KAV: {
    flex: 1,
    alignItems: 'center'
  },
  textStyle: {
    alignSelf: 'center'
  }
})

const { KAV, textStyle } = styles

export { SignIn }
