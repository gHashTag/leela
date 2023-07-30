import { yupResolver } from '@hookform/resolvers/yup'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { ReactElement, useState } from 'react'
import { useMemo } from 'react'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import {
  AppContainer,
  Button,
  Input,
  KeyboardContainer,
  Loading,
  Space
} from '../../../components'
import {
  H,
  W,
  black,
  captureException,
  goBack,
  white
} from '../../../constants'
import { updateProfName } from '../../../screens/helper'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'USER_EDIT'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'USER_EDIT'>

type UserEditT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const UserEdit = ({ route, navigation }: UserEditT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          firstName: yup
            .string()
            .trim()
            .min(2, t('twoSymbolRequire') || '')
            .required()
            .max(15, `${t('manyCharacters')}15`),
          lastName: yup
            .string()
            .trim()
            .min(2, t('twoSymbolRequire') || '')
            .required()
            .max(20, `${t('manyCharacters')}20`)
        })
        .required(),
    [t]
  )
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { ...route.params }
  })

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { firstName, lastName } = data
    await updateProfName({ firstName, lastName })
    navigation.goBack()
    setLoading(false)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      onPress={goBack}
      title=" "
      colorLeft={black}
      hidestar
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
                placeholder={t('auth.firstName')}
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Input
                name="lastName"
                placeholder={t('auth.lastName')}
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Space height={30} />
              <Button
                title={t('done')}
                onPress={methods.handleSubmit(onSubmit, (error) =>
                  captureException(error, 'UserEdit')
                )}
              />
              <Space height={vs(10)} />
            </FormProvider>
          </ScrollView>
        </KeyboardContainer>
      )}
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center'
  }
})

export { UserEdit }
