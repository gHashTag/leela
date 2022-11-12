import React, { ReactElement } from 'react'

import { useTheme } from '@react-navigation/native'
import { FieldValues, FormProvider, SubmitErrorHandler } from 'react-hook-form'
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
import { H, W, black, goBack, white } from '../../../constants'
import { I18n } from '../../../utils'

const SignUp = (): ReactElement => {
  const { loading, error, methods, onSubmit } = useSignUp()
  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

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
              contentContainerStyle={styles.container}
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
                  placeholder={I18n.t('password')}
                  secureTextEntry
                  color={color}
                  additionalStyle={{ width: W - s(40) }}
                />
                <Input
                  name="passwordConfirmation"
                  placeholder={I18n.t('passwordConfirmation')}
                  secureTextEntry
                  color={color}
                  additionalStyle={{ width: W - s(40) }}
                />
                <Space height={vs(30)} />
                {error !== '' && (
                  <TextError title={error} textStyle={{ textAlign: 'center' }} />
                )}
                <Space height={vs(20)} />
                <Button
                  title={I18n.t('signUp')}
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
})

export { SignUp }
