import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { RouteProp, useTheme } from '@react-navigation/native'
import { AppContainer, Space, Button, Input, Loading } from '../../../components'
import { goBack, white, black, W, H } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { actionsDice, fetchBusinesses } from '../../../store'
import auth from '@react-native-firebase/auth'
import { createProfile, getUid } from '../../helper'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  useForm,
  FormProvider,
  SubmitHandler,
  SubmitErrorHandler,
  FieldValues
} from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { s } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'

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
    firstName: yup.string().trim().min(2).required(),
    lastName: yup.string().trim().min(2).required()
  })
  .required()

const SignUpUsername = ({ route, navigation }: SignUpUsernameT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { firstName, lastName } = data
    const { email } = route.params
    await auth().currentUser?.updateProfile({
      displayName: `${firstName} ${lastName}`
    })
    await createProfile({
      email,
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
  const headerHeight = useHeaderHeight()
  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer onPress={goBack(navigation)} title=" " iconLeft={null}>
      {loading ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView
          keyboardVerticalOffset={headerHeight}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.KAV}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
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
              <Space height={30} />
              <Button
                title={I18n.t('signUp')}
                onPress={methods.handleSubmit(onSubmit, onError)}
              />
              <Space height={50} />
            </FormProvider>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  KAV: {
    flex: 1,
    alignItems: 'center'
  }
})

export { SignUpUsername }
