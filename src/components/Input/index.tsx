import React from 'react'
import { TextInput, StyleSheet, Text, Platform, ColorValue, StyleProp, View, ViewStyle } from 'react-native'
import { ScaledSheet } from 'react-native-size-matters'
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
  ...inputProps
}) => {
  const { inputStyle, errorStyle } = styles

  const formContext = useFormContext()

  if (!formContext || !name) {
    const msg = !formContext ? "TextInput должен быть обернут в FormProvider"
      : "Имя должно быть определено(Input)"
    console.error(msg)
    return null
  }

  const { formState } = formContext
  const { field } = useController({ name, rules, defaultValue })
  const hasError = Boolean(formState?.errors[name])

  const input = ScaledSheet.create([
    inputStyle,
    {
      fontFamily: 'Avenir Next',
      color,
      borderBottomColor: color,
      fontSize: Platform.OS === 'ios' ? '15@s' : '15@s'
    }
  ])

  const placeholderStyle = ScaledSheet.create([
    inputStyle,
    {
      fontFamily: 'Avenir Next',
      color: dimGray,
      borderBottomColor: classicRose,
      fontSize: Platform.OS === 'ios' ? '15@s' : '15@s'
    }
  ])

  return <View style={additionalStyle}>
    <TextInput
      style={field.value?.length === 0 ? placeholderStyle : input}
      placeholderTextColor={dimGray}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      value={field.value}
      {...inputProps}
    />
    {hasError ?
      <Text style={errorStyle}>{formState.errors[name].message}</Text>
      :
      <Text style={errorStyle}>{'  '}</Text>
    }
  </View>
}

const styles = StyleSheet.create({
  inputStyle: {
    fontSize: 14,
    alignSelf: 'center',
    width: '95%',
    borderBottomWidth: 2
  },
  errorStyle: {
    fontSize: 14,
    color: 'red',
    paddingTop: 10,
    left: 5
  }
})

export { Input }
