import React from 'react'
import {
  TextInput,
  StyleSheet,
  Text,
  Platform,
  ColorValue,
  StyleProp,
  View,
  ViewStyle
} from 'react-native'
import { s, ScaledSheet, vs } from 'react-native-size-matters'
import { W, dimGray, classicRose } from '../../constants'
import { useController, useFormContext } from 'react-hook-form'
import { TextInputProps as RNTextInputProps } from 'react-native'
import { UseControllerProps } from 'react-hook-form'

export interface TextInputProps extends RNTextInputProps, UseControllerProps {
  color: ColorValue
  defaultValue?: string
  additionalStyle?: StyleProp<ViewStyle>
  showError?: boolean
}

const Input: React.FC<TextInputProps> = ({
  name,
  color,
  rules,
  defaultValue,
  additionalStyle,
  showError = true,
  style,
  onBlur,
  ...inputProps
}) => {
  const { inputStyle, errorStyle, inputArea } = styles

  const formContext = useFormContext()

  if (!formContext || !name) {
    const msg = !formContext
      ? 'TextInput должен быть обернут в FormProvider'
      : 'Имя должно быть определено(Input)'
    console.error(msg)
    return null
  }

  const { formState } = formContext
  const { field } = useController({ name, rules, defaultValue })
  const hasError = Boolean(formState?.errors[name])

  const input = ScaledSheet.create([
    inputProps.multiline ? inputArea : inputStyle,
    {
      color,
      borderBottomColor: color
    }
  ])

  const placeholderStyle = ScaledSheet.create([
    inputProps.multiline ? inputArea : inputStyle,
    {
      color: dimGray,
      borderColor: classicRose
    }
  ])

  return (
    <View style={additionalStyle}>
      <TextInput
        style={[style, hasError ? placeholderStyle : input]}
        placeholderTextColor={dimGray}
        onChangeText={field.onChange}
        onBlur={() => {
          field.onBlur()
          onBlur && onBlur()
        }}
        ref={field.ref}
        value={field.value}
        {...inputProps}
      />
      {showError && (
        <>
          {hasError ? (
            <Text style={errorStyle}>{formState.errors[name].message}</Text>
          ) : (
            <Text style={errorStyle}>{'  '}</Text>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  inputStyle: {
    fontSize: s(16),
    width: '95%',
    borderBottomWidth: 2
  },
  errorStyle: {
    fontSize: 14,
    color: 'red',
    paddingTop: 10,
    left: 5
  },
  inputArea: {
    fontSize: s(16),
    width: '95%',
    borderWidth: s(1.5),
    height: vs(120),
    textAlignVertical: 'top',
    paddingHorizontal: s(10),
    borderRadius: s(10)
  }
})

export { Input }
