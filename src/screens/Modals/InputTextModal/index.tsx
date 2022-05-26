import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { RootStackParamList } from '../../../types'

import { Input, Text } from '../../../components'
import { black, navigate, primary, W } from '../../../constants'
import { PostStore } from '../../../store'
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import I18n from 'i18n-js'

interface CreateCommentT {
  id: string
  owner: string
  reply?: boolean
}

interface ReplyModalT {
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

export function InputTextModal({ navigation, route }: ReplyModalT) {
  const { onError, onSubmit } = route.params
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })
  const [length, setLength] = useState(0)

  useEffect(() => {
    setTimeout(() => methods.setFocus('text'), 100)
  }, [])

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    console.log('submit')
    onSubmit && onSubmit(data.text)
    navigation.goBack()
    methods.reset()
  }
  return (
    <View style={transparentView}>
      <Pressable onPress={() => navigation.goBack()} style={goBackView} />
      <View style={[inputContainer, { backgroundColor: primary }]}>
        <FormProvider {...methods}>
          <Input
            onChange={e => setLength(e.nativeEvent.text.length)}
            name="text"
            placeholder={I18n.t('uComment')}
            color={black}
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
    </View>
  )
}

const styles = StyleSheet.create({
  transparentView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  input: {
    width: W - s(65),
    marginBottom: vs(10)
  },
  inputContainer: {
    paddingHorizontal: vs(5),
    paddingTop: vs(5),
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: s(8),
    borderTopRightRadius: s(8),
    flexDirection: 'row',
    alignItems: 'center'
  },
  goBackView: {
    height: '100%',
    width: '100%'
  }
})
const { inputContainer, input, transparentView, goBackView } = styles
