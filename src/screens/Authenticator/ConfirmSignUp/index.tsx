import React, { useState, ReactElement, useEffect } from 'react'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Button, Space, Text, Loading } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import auth from '@react-native-firebase/auth'
import { s, vs } from 'react-native-size-matters'
import { View } from 'react-native'
import { actionsDice } from '../../../store'

type ProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CONFIRM_SIGN_UP'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'CONFIRM_SIGN_UP'>

type ConfirmSignUpT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const ConfirmSignUp = ({ route, navigation }: ConfirmSignUpT): ReactElement => {
  const [isVerfy, setIsVerfy] = useState<boolean | undefined>(false)

  useEffect(() => {
    const verfyCheck = setInterval(() => {
      auth().currentUser?.reload()
      const { emailVerified }: { emailVerified?: boolean } = auth().currentUser
      if (emailVerified !== isVerfy) {
        setIsVerfy(emailVerified)
        if (emailVerified) {
          clearInterval(verfyCheck)
          actionsDice.init()
          navigation.navigate('SIGN_UP_USERNAME', route.params)
        }
      }
    }, 2200)
    return () => clearInterval(verfyCheck)
  }, [])

  const _onResend = async (): Promise<void> => {
    auth().currentUser?.sendEmailVerification()
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      title=" "
      onPress={goBack(navigation)}
      loading={false}
      colorLeft={color}
    >
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Space height={vs(90)} />
        <Text h={'h1'} title={'Check your email!'} />
        <Space height={vs(30)} />
      </View>

      <Loading size={s(100)} type="9CubeGrid" loading={true} />

      <Button title={'Resend?'} onPress={_onResend} />
      {/*<Txt h4 title={'Resend?'} />*/}
      <Space height={vs(30)} />
      {/*<Formik
        initialValues={{ code: '' }}
        onSubmit={(values): Promise<void> => _onPress(values)}
        validationSchema={Yup.object().shape({
          code: Yup.string().min(6).required()
        })}
      >
        {({ values, handleChange, errors, setFieldTouched, touched, handleSubmit }): ReactElement => (
          <>
            <Input
              name="code"
              value={values.code}
              onChangeText={handleChange('code')}
              onBlur={(): void => setFieldTouched('code')}
              placeholder={I18n.t('insertCode')}
              touched={touched}
              errors={errors}
              color={color}
            />
            <ButtonLink title={I18n.t('resendCode')} onPress={_onResend} textStyle={{ alignSelf: 'center' }} />
            {error !== '' && <TextError title={error} />}
            <Space height={50} />
            <Button title={I18n.t('confirm')} onPress={handleSubmit} color={color} />
            <Space height={50} />
          </>
        )}
        </Formik>*/}
    </AppContainer>
  )
}

export { ConfirmSignUp }
