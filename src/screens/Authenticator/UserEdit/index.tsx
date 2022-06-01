import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Space, Button, Input, Loading } from '../../../components'
import { goBack, white, black, W, H } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { updateProfName } from '../../../screens/helper'
import { useHeaderHeight } from '@react-navigation/elements'
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'USER_EDIT'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'USER_EDIT'>

type UserEditT = {
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

const UserEdit = ({ route, navigation }: UserEditT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const headerHeight = useHeaderHeight()
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { ...route.params }
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { firstName, lastName } = data
    await updateProfName({ firstName, lastName })
    navigation.goBack()
    setLoading(false)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return loading ? (
    <Loading />
  ) : (
    <AppContainer onPress={goBack(navigation)} title=" " colorLeft={black}>
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
              title={I18n.t('done')}
              onPress={methods.handleSubmit(onSubmit, er => console.log(er))}
            />
            <Space height={vs(50)} />
          </FormProvider>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  KAV: {
    flex: 1,
    alignItems: 'center'
  }
})

export { UserEdit }
