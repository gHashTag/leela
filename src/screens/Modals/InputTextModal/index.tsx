import React, { useEffect, useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FieldValues, FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import { Input, KeyboardContainer, Text } from '../../../components'
import { W, secondary } from '../../../constants'
import { RootStackParamList } from '../../../types'

interface InputTextT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
  route: RouteProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
}
const max = 1000
const schema = yup
  .object()
  .shape({
    text: yup.string().trim().min(2).max(max).required(),
  })
  .required()

export function InputTextModal({ navigation, route }: InputTextT) {
  const { onError, onSubmit } = route.params
  const { t } = useTranslation()

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
  })
  const [length, setLength] = useState(0)

  useEffect(() => {
    setTimeout(() => methods.setFocus('text'), 100)
  }, [methods])
  const {
    colors: { background, text },
  } = useTheme()

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    onSubmit && onSubmit(data.text)
    navigation.goBack()
    methods.reset()
  }
  return (
    <View style={page.transparentView}>
      <KeyboardContainer>
        <Pressable onPress={() => navigation.goBack()} style={page.goBackView} />
        <View style={[page.inputContainer, { backgroundColor: background }]}>
          <FormProvider {...methods}>
            <Input
              onChange={e => setLength(e.nativeEvent.text.length)}
              name="text"
              placeholder={t('online-part.uComment')}
              color={text}
              additionalStyle={page.input}
              showError={false}
              onSubmitEditing={methods.handleSubmit(
                handleSubmit,
                err => onError && onError(err),
              )}
            />
            <Text h="h9" title={`(${length}/${max})`} />
          </FormProvider>
        </View>
      </KeyboardContainer>
    </View>
  )
}

const page = StyleSheet.create({
  transparentView: {
    flex: 1,
  },
  input: {
    width: W - s(65),
    marginBottom: vs(10),
  },
  inputContainer: {
    paddingHorizontal: vs(5),
    paddingTop: vs(10),
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: s(8),
    borderTopRightRadius: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: s(1),
    borderBottomWidth: 0,
    borderColor: secondary,
  },
  goBackView: {
    flex: 1,
  },
})
