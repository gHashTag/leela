import React, { ReactElement } from 'react'

import { useTheme } from '@react-navigation/native'
import { FieldValues, FormProvider, SubmitErrorHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { useSignUp } from './useSignUp'

import {
  AppContainer,
  Button,
  Input,
  KeyboardContainer,
  Loading,
  Space,
  TextError,
} from '../../../components'
import { H, W, black, captureException, goBack, white } from '../../../constants'

export const SignUp = (): ReactElement => {
  const { loading, error, methods, onSubmit } = useSignUp()
  const onError: SubmitErrorHandler<FieldValues> = errors => {
    captureException(errors, 'SignUp')
  }
  const { t } = useTranslation()

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      onPress={goBack}
      title=" "
      colorLeft={color}
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          <KeyboardContainer>
            <ScrollView
              contentContainerStyle={page.container}
              showsVerticalScrollIndicator={false}
            >
              <Space height={H / 7} />
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
                <Input
                  name="passwordConfirmation"
                  placeholder={t('auth.passwordConfirmation')}
                  secureTextEntry
                  color={color}
                  additionalStyle={{ width: W - s(40) }}
                />
                <Space height={vs(30)} />
                {error !== '' && <TextError title={error} textStyle={page.centerText} />}
                <Space height={vs(20)} />
                <Button
                  title={t('auth.signUp')}
                  onPress={methods.handleSubmit(onSubmit, onError)}
                />
                <Space height={vs(10)} />
              </FormProvider>
            </ScrollView>
          </KeyboardContainer>
        </>
      )}
    </AppContainer>
  )
}

const page = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerText: { textAlign: 'center' },
})
