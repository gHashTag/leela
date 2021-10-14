import React, { useState, ReactElement, useRef } from 'react'
import { Auth, API, graphqlOperation, DataStore } from 'aws-amplify'
import { Formik, FormikProps } from 'formik'
import * as Yup from 'yup'
import { v4 as uuidv4 } from 'uuid'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { Profile } from '../../../models'
import { Profile as ProfileT } from '../../../models'
import { AppContainer, Space, Button, Input } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList, UserT } from '../../../types'
import { actionsDice } from '../../../store'
//import { pickAva, createImage } from '../../../screens/helper'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_UP_USERNAME'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_USERNAME'>

type SignUpUsernameT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const SignUpUsername = ({ route, navigation }: SignUpUsernameT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const formikRef = useRef<FormikProps<any>>()

  // const createObj = async (values: UserT) => {
  //   setLoading(true)
  //   try {
  //     const obj = await API.graphql(graphqlOperation(createProfile, { input: values }))
  //     //console.log('obj', obj)
  //     obj && navigation.navigate('MAIN')
  //     setLoading(false)
  //   } catch (err) {
  //     captureException(err.message)
  //     setError(err.message)

  //   }
  // }

  const createProfile = async (values: ProfileT) => {
    try {
      await DataStore.save(new Profile({ ...values }))
      navigation.navigate('MAIN')
      console.log("Profile saved successfully!");
      actionsDice.setOnline(true)
      actionsDice.setPlayers(1)
    } catch (error) {
      console.log("Error saving profile", error)
    }
  }
   

  const _onPress = async (values: { firstName: string; lastName: string }): Promise<void> => {
    setLoading(true)
    // if (avatar.key === '') {
    //   setError('Pick a face')
    //   setLoading(false)
    // } else {
    const { firstName, lastName } = values
    const { email } = route.params
    const owner = await Auth.currentAuthenticatedUser()

    createProfile({ id: uuidv4(), firstName, lastName, email, plan: 68, owner: owner.username })
    setLoading(false)
  }

  // const onPressAva = async () => {
  //   setLoading(true)
  //   const ava = await pickAva()
  //   const image = await createImage(ava)
  //   setAvatar(image)
  //   setLoading(false)
  // }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      backgroundColor={dark ? black : white}
      onPress={goBack(navigation)}
      title=" "
      colorLeft={color}
      loading={loading}
    >
      <Space height={30} />
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
//<Avatar size="xLarge" avatar={avatar} onPress={onPressAva} loading={loading} />

export { SignUpUsername }
