import React, { useEffect, useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import { Input, KeyboardContainer, Text } from '../../../components'
import { W, captureException, secondary } from '../../../constants'
import { RootStackParamList } from '../../../types/types'

interface InputTextT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
  route: RouteProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
}
const max = 1000
const schema = yup
  .object()
  .shape({
    text: yup.string().trim().min(2).max(max).required()
  })
  .required()

export function InputTextModal({ navigation, route }: InputTextT) {
  const { onError, onSubmit } = route.params
  const { t } = useTranslation()

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })
  const [length, setLength] = useState(0)

  // The timer is cleared when this goes away, and that is the whole bug.
  //
  // `setFocus` reaches into react-hook-form's `_fields[name]._f`, so focusing a
  // field that is no longer registered throws `Cannot read property '_f' of
  // undefined` — uncaught, red screen, and the comment box is gone. Nothing
  // cleared this timer, and the input closes itself on blur, so one hundred
  // milliseconds was long enough for the field to disappear before the focus
  // arrived.
  useEffect(() => {
    const focusing = setTimeout(() => methods.setFocus('text'), 100)
    return () => clearTimeout(focusing)
  }, [methods])
  const {
    colors: { background, text }
  } = useTheme()

  const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
    try {
      if (onSubmit) {
        await onSubmit(data.text)
      }
    } catch (error) {
      if (onError) {
        onError(error)
      } else {
        captureException(error, 'InputTextModal: submit')
      }
      return
    }
    navigation.goBack()
    methods.reset()
  }
  return (
    <View style={styles.transparentView}>
      <KeyboardContainer>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.goBackView}
        />
        <View style={[styles.inputContainer, { backgroundColor: background }]}>
          <FormProvider {...methods}>
            <Input
              onChange={(e) => setLength(e.nativeEvent.text.length)}
              name="text"
              placeholder={t('online-part.uComment')}
              color={text}
              additionalStyle={styles.input}
              showError={false}
              onSubmitEditing={methods.handleSubmit(
                handleSubmit,
                (err) => onError && onError(err)
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
