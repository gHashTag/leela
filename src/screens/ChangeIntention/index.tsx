import React, { useState } from 'react'
import { I18n } from '../../utils'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
import { Space, Button, Input, Loading, AppContainer } from '../../components'
import { white, black } from '../../constants'
import { RootStackParamList } from '../../types'
import { updateIntention } from '../../screens/helper'
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { mvs, vs } from 'react-native-size-matters'
import { StyleSheet, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

const schema = yup
  .object()
  .shape({
    newIntention: yup
      .string()
      .trim()
      .min(2, I18n.t('twoSymbolRequire'))
      .required()
      .max(200, `${I18n.t('manyCharacters')}250`)
  })
  .required()

type ChangeIntentionScreenNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'CHANGE_INTENTION_SCREEN'
>
type ChangeIntentionRouteProp = RouteProp<RootStackParamList, 'CHANGE_INTENTION_SCREEN'>

interface ChangeIntentionT {
  navigation: ChangeIntentionScreenNavProp
  route: ChangeIntentionRouteProp
}

export const ChangeIntention = ({ navigation, route }: ChangeIntentionT) => {
  const { prevIntention, blockGoBack, title } = route.params || {}
  const [loading, setLoading] = useState<boolean>(false)
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { newIntention: prevIntention || '' }
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { newIntention } = data
    await updateIntention(newIntention)
    navigation.goBack()
    setLoading(false)
  }

  const {
    dark,
    colors: { background: backgroundColor }
  } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      iconLeft={blockGoBack ? undefined : 'back'}
      onPress={navigation.goBack}
      textAlign="center"
      title={title || I18n.t('updateIntention')}
      colorLeft={black}
    >
      {loading ? (
        <Loading />
      ) : (
        <View style={container}>
          <FormProvider {...methods}>
            <Space height={mvs(80, 0.4)} />
            <Input
              name="newIntention"
              color={color}
              multiline
              autoCapitalize="none"
              placeholder={I18n.t('intention')}
              additionalStyle={[bigInput, { backgroundColor }]}
            />
            <Space height={10} />
            <Button
              title={I18n.t('done')}
              onPress={methods.handleSubmit(onSubmit, er => console.log(er))}
            />
            <Space height={vs(50)} />
          </FormProvider>
        </View>
      )}
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center'
  },
  bigInput: {
    width: '100%',
    alignItems: 'center'
  }
})

const { container, bigInput } = styles
