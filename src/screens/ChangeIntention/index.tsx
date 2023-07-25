import React, { useMemo, useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FieldValues, FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { mvs, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import { AppContainer, Button, Input, Loading, Space } from '../../components'
import { black, captureException, lightGray } from '../../constants'
import { updateIntention } from '../../screens/helper'
import { RootStackParamList } from '../../types'

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
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          newIntention: yup
            .string()
            .trim()
            .min(2, t('twoSymbolRequire') || '')
            .required()
            .max(800, `${t('manyCharacters')}800`),
        })
        .required(),
    [t],
  )

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { newIntention: prevIntention || '' },
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { newIntention } = data
    await updateIntention(newIntention)
    navigation.navigate('MAIN')
    setLoading(false)
  }

  const {
    colors: { background: backgroundColor },
  } = useTheme()

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={blockGoBack ? undefined : 'back'}
      onPress={navigation.goBack}
      textAlign="center"
      title={title || t('online-part.updateIntention')}
      colorLeft={black}
    >
      {loading ? (
        <Loading />
      ) : (
        <View style={page.container}>
          <FormProvider {...methods}>
            <Space height={mvs(80, 0.4)} />
            <Input
              name="newIntention"
              color={lightGray}
              multiline
              autoCapitalize="none"
              placeholder={t('intention')}
              additionalStyle={[page.bigInput, { backgroundColor }]}
            />
            <Space height={10} />
            <Button
              title={t('done')}
              onPress={methods.handleSubmit(onSubmit, errors =>
                captureException(errors, 'ChangeIntention'),
              )}
            />
            <Space height={vs(50)} />
          </FormProvider>
        </View>
      )}
    </AppContainer>
  )
}

const page = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  bigInput: {
    width: '100%',
    alignItems: 'center',
  },
})
