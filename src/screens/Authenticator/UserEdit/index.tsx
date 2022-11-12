import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
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
import { updateProfName } from '../../../screens/helper'
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView, StyleSheet } from 'react-native'

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

const UserEdit = ({ route, navigation }: UserEditT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
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

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      onPress={goBack}
      title=" "
      colorLeft={black}
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
              <Space height={30} />
              <Button
                title={I18n.t('done')}
                onPress={methods.handleSubmit(onSubmit, er => console.log(er))}
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
