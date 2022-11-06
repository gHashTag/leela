import React, { useEffect, useState } from 'react'
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { RootStackParamList } from '../../../types'

import { Input, KeyboardContainer, Text } from '../../../components'
import { secondary, W } from '../../../constants'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import I18n from 'i18n-js'

interface InputTextT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
  route: RouteProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
}
const max = 250
const schema = yup
  .object()
  .shape({
    text: yup.string().trim().min(2).max(max).required()
  })
  .required()

export function InputTextModal({ navigation, route }: InputTextT) {
  const { onError, onSubmit } = route.params
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })
  const [length, setLength] = useState(0)

  useEffect(() => {
    setTimeout(() => methods.setFocus('text'), 100)
  }, [])
  const {
    colors: { background, text }
  } = useTheme()

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    onSubmit && onSubmit(data.text)
    navigation.goBack()
    methods.reset()
  }
  return (
    <View style={transparentView}>
      <KeyboardContainer>
        <Pressable onPress={() => navigation.goBack()} style={goBackView} />
        <View style={[inputContainer, { backgroundColor: background }]}>
          <FormProvider {...methods}>
            <Input
              onChange={e => setLength(e.nativeEvent.text.length)}
              name="text"
              placeholder={I18n.t('uComment')}
              color={text}
              additionalStyle={input}
              showError={false}
              onSubmitEditing={methods.handleSubmit(
                handleSubmit,
                err => onError && onError(err)
              )}
            />
            <Text h="h9" title={`(${length}/${max})`} />
          </FormProvider>
        </View>
      </KeyboardContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  transparentView: {
    flex: 1
  },
  input: {
    width: W - s(65),
    marginBottom: vs(10)
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
    borderColor: secondary
  },
  goBackView: {
    flex: 1
  }
})
const { inputContainer, input, transparentView, goBackView } = styles
