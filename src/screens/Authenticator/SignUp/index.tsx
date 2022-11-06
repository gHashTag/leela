import React, { ReactElement } from 'react'
import { I18n } from '../../../utils'
import {
  AppContainer,
  Space,
  Button,
  Input,
  TextError,
  Loading,
  KeyboardContainer
} from '../../../components'
import { goBack, white, black, W, H } from '../../../constants'
import { useTheme } from '@react-navigation/native'

import { FormProvider, SubmitErrorHandler, FieldValues } from 'react-hook-form'
import { s, vs } from 'react-native-size-matters'
import { ScrollView, StyleSheet } from 'react-native'
import { useSignUp } from './useSignUp'

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
                <Space height={vs(50)} />
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
    alignItems: 'center'
  }
})

export { SignUp }
