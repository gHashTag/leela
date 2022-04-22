import React, { useState, ReactElement, useRef, useEffect } from 'react'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Space, Button, Input } from '../../../components'
import { goBack, white, black, W } from '../../../constants'
import { RootStackParamList, UserT } from '../../../types'
import { updateProfName } from '../../../screens/helper'

import { useForm, FormProvider, SubmitHandler, SubmitErrorHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import { s } from 'react-native-size-matters'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'USER_EDIT'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'USER_EDIT'>

type UserEditT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const schema = yup.object().shape({
  firstName: yup.string().trim().min(2).required(),
  lastName: yup.string().trim().min(2).required()
}).required()

const UserEdit = ({ route, navigation }: UserEditT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { ...route.params }
  })

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { firstName, lastName } = data
    updateProfName({ firstName, lastName })
    goBack(navigation)()
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <>
      <AppContainer
        backgroundColor={dark ? black : white}
        onPress={goBack(navigation)}
        title=" "
        loading={loading}
        colorLeft={black}
      >
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
          <Button title={I18n.t('done')} onPress={methods.handleSubmit(onSubmit,
            (er) => console.log(er))} color={black} />
          <Space height={200} />
        </FormProvider>
      </AppContainer>
    </>
  )
}

export { UserEdit }
