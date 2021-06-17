import React from 'react'
import { Text, View, TextInput, Button, StyleSheet } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../'
import { Background, ButtonElements } from '../../components'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_2'>

type ChatScreenT = {
  navigation: navigation
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1
  }
})

const ChatScreen = observer(({ navigation }: ChatScreenT) => {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const onSubmit = data => console.log(data)

  return (
    <Background imageStyle={{ justifyContent: 'center' }}>
      <View>
        <Controller
          control={control}
          rules={{
            required: true
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput style={styles.input} onBlur={onBlur} onChangeText={value => onChange(value)} value={value} />
          )}
          name="firstName"
          rules={{ required: true }}
          defaultValue=""
        />
        {errors.firstName && <Text>This is required.</Text>}

        <Controller
          control={control}
          rules={{
            maxLength: 100
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput style={styles.input} onBlur={onBlur} onChangeText={value => onChange(value)} value={value} />
          )}
          name="lastName"
          defaultValue=""
        />

        <Button title="Submit" onPress={handleSubmit(onSubmit)} />
      </View>
      <ButtonElements title={I18n.t('signIn')} onPress={() => navigation.navigate('PLAYRA_SCREEN')} />
    </Background>
  )
})

export { ChatScreen }
