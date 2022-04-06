import React, { useState, ReactElement, useRef } from 'react'
import { Auth, DataStore } from 'aws-amplify'
import { Formik, FormikProps } from 'formik'
import * as Yup from 'yup'
import { v4 as uuidv4 } from 'uuid'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { Profile } from '../../../models'
import { Profile as ProfileT } from '../../../models'
import { AppContainer, Space, Button, Input, Avatar } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList, UserT } from '../../../types'
import { actionsDice } from '../../../store'
import { MainRoom } from '../../../models'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_UP_USERNAME'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_USERNAME'>

type SignUpUsernameT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const SignUpUsername = ({ route, navigation }: SignUpUsernameT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const formikRef = useRef<FormikProps<any>>()

  const createProfile = async (values: ProfileT) => {
    try {
      await DataStore.save(new Profile({ ...values }))
      navigation.navigate('SIGN_UP_AVATAR')
      actionsDice.setOnline(true)
      actionsDice.setPlayers(1)
    } catch (error) {
      captureException(error)
    }
  }

  const _onPress = async (values: { firstName: string; lastName: string }): Promise<void> => {
    setLoading(true)
    const { firstName, lastName } = values
    const { email } = route.params
    const room = await DataStore.query(MainRoom)
    room.length > 0 &&
    createProfile({ id: uuidv4(), firstName, lastName, email, 
      plan: 68, avatar: '', firstGame: true, 
      lastStepTime: (Date.now() - 86400000).toString(),
      mainHelper: room[0].id })
    setLoading(false)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      backgroundColor={dark ? black : white}
      onPress={goBack(navigation)}
      title=" "
      iconLeft={null}
      loading={loading}
    >
      <Formik
        innerRef={r => (formikRef.current = r || undefined)}
        initialValues={{ firstName: '', lastName: '' }}
        onSubmit={(values): Promise<void> => _onPress(values)}
        validationSchema={Yup.object().shape({
          firstName: Yup.string().min(2).required(),
          lastName: Yup.string().min(2).required()
        })}
      >
        {({ values, handleChange, errors, setFieldTouched, touched, handleSubmit }): ReactElement => (
          <>
            <Input
              name="firstName"
              value={values.firstName}
              onChangeText={handleChange('firstName')}
              onBlur={(): void => setFieldTouched('firstName')}
              placeholder={I18n.t('firstName')}
              touched={touched}
              errors={errors}
              autoCapitalize="none"
              color={color}
            />
            <Input
              name="lastName"
              value={values.lastName}
              onChangeText={handleChange('lastName')}
              onBlur={(): void => setFieldTouched('lastName')}
              placeholder={I18n.t('lastName')}
              touched={touched}
              errors={errors}
              autoCapitalize="none"
              color={color}
            />
            <Space height={30} />
            <Button title={I18n.t('signUp')} onPress={handleSubmit} color={color} />
            <Space height={50} />
          </>
        )}
      </Formik>
    </AppContainer>
  )
}

export { SignUpUsername }
