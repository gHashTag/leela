import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet
} from 'react-native'
import { s, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import { Input } from '..'
import { Text } from '../'
import { W, black, captureException, primary } from '../../constants'
import { PostStore } from '../../store'

interface CreateCommentT {
  visible: boolean
  setVisible: Dispatch<SetStateAction<boolean>>
  postId: string
  postOwner: string
}

const schema = yup
  .object()
  .shape({
    text: yup.string().trim().min(2).max(250).required()
  })
  .required()

export function CreateComment({
  visible,
  setVisible,
  postId,
  postOwner
}: CreateCommentT) {
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })
  const [length, setLength] = useState(0)
  useEffect(() => {
    if (visible) {
      setTimeout(() => methods.setFocus('text'), 200)
    }
  }, [visible, methods])
  const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
    methods.reset()
    setVisible(false)
    await PostStore.createComment({ text: data.text, postOwner, postId })
  }
  return visible ? (
    <KeyboardAvoidingView
      onTouchEnd={Keyboard.dismiss}
      behavior="padding"
      style={avoidingView}
    >
      <Pressable style={[inputContainer, { backgroundColor: primary }]}>
        <FormProvider {...methods}>
          <Input
            onChange={(e) => setLength(e.nativeEvent.text.length)}
            onBlur={() => setVisible(false)}
            name="text"
            placeholder="Comment input"
            color={black}
            additionalStyle={input}
            showError={false}
            onSubmitEditing={methods.handleSubmit(handleSubmit, (error) =>
              captureException(error, 'CreateComment')
            )}
          />
          <Text h="h9" title={`(${length}/250)`} />
        </FormProvider>
      </Pressable>
    </KeyboardAvoidingView>
  ) : null
}

const styles = StyleSheet.create({
  input: {
    width: W - s(65),
    marginBottom: vs(10)
  },
  inputContainer: {
    paddingHorizontal: vs(5),
    paddingTop: vs(5),
    bottom: 0,
    position: 'absolute',
    width: '100%',
    borderTopLeftRadius: s(8),
    borderTopRightRadius: s(8),
    flexDirection: 'row',
    alignItems: 'center'
  },
  avoidingView: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    zIndex: 20
  }
})
const { inputContainer, input, avoidingView } = styles
