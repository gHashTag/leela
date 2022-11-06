import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { RouteProp, useTheme } from '@react-navigation/native'
import {
  AppContainer,
  Space,
  Button,
  Input,
  Loading,
  KeyboardContainer
} from '../../../components'
import { goBack, white, black, W, H } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { actionsDice, fetchBusinesses } from '../../../store'
import auth from '@react-native-firebase/auth'
import { createProfile, getUid } from '../../helper'
import {
  useForm,
  FormProvider,
  SubmitHandler,
  SubmitErrorHandler,
  FieldValues
} from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView, StyleSheet } from 'react-native'
import { useNoBackHandler } from '../../../hooks'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_UP_USERNAME'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_USERNAME'>

type SignUpUsernameT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const schema = yup
  .object()
  .shape({
    firstName: yup
      .string()
      .trim()
      .min(2, I18n.t('twoSymbolRequire'))
      .required()
      .max(15, `${I18n.t('manyCharacters')}15`),
    lastName: yup
      .string()
      .trim()
      .min(2, I18n.t('twoSymbolRequire'))
      .required()
      .max(20, `${I18n.t('manyCharacters')}20`)
  })
  .required()

const SignUpUsername = ({ route, navigation }: SignUpUsernameT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })
  useNoBackHandler()

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { firstName, lastName } = data
    const { email } = route.params
    await auth().currentUser?.updateProfile({
      displayName: `${firstName} ${lastName}`
    })
    await createProfile({
      email,
      // @ts-ignore
      uid: getUid(),
      firstName,
      lastName
    })
    fetchBusinesses()
    navigation.navigate('SIGN_UP_AVATAR')
    actionsDice.setOnline(true)
    actionsDice.setPlayers(1)
    setLoading(false)
  }
  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      enableBackgroundBottomInsets
      enableBackgroundTopInsets
      onPress={goBack}
      title=" "
      iconLeft={null}
    >
      {loading ? (
        <Loading />
      ) : (
        <KeyboardContainer>
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <Space height={H / 5} />
            <FormProvider {...methods}>
              <Input
                name="firstName"
                placeholder={I18n.t('firstName')}
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Input
                name="lastName"
                placeholder={I18n.t('lastName')}
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Space height={vs(30)} />
              <Button
                title={I18n.t('signUp')}
                onPress={methods.handleSubmit(onSubmit, onError)}
              />
              <Space height={50} />
            </FormProvider>
          </ScrollView>
        </KeyboardContainer>
      )}
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center'
  }
})

export { SignUpUsername }
