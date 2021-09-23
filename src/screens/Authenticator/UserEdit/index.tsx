import React, { useState, ReactElement, useRef, useEffect } from 'react'
import { Auth, API, graphqlOperation } from 'aws-amplify'
import { Formik, FormikProps } from 'formik'
import * as Yup from 'yup'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTheme } from '@react-navigation/native'
import { RouteProp } from '@react-navigation/native'
// import { DataStore } from '@aws-amplify/datastore'
// import { Profile } from '../../models'
import { AppContainer, Space, Button, Input } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList, UserT } from '../../../types'
//import config from '../../../aws-exports'
//import { updateImage, pickAva } from '../../screens/helper'
import { updateProfile } from '../../../graphql/mutations'

// const { aws_user_files_s3_bucket_region: region, aws_user_files_s3_bucket: bucket } = config

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'USER_EDIT'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'USER_EDIT'>

type UserEditT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const UserEdit = ({ route, navigation }: UserEditT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const formikRef = useRef<FormikProps<any>>()
  // const [avatar, setAvatar] = useState<S3ObjectT>({
  //   bucket: '',
  //   region: '',
  //   key: ''
  // })

  const [input, setObj] = useState<UserT>({
    id: '0',
    firstName: '',
    lastName: '',
    email: '',
    plan: 68
    //avatar
  })

  useEffect(() => {
    setLoading(true)
    const obj = route.params
    if (typeof obj !== 'undefined') {
      setObj(obj)
      // @ts-expect-error
      const { setFieldValue } = formikRef.current
      const { id, firstName, lastName } = obj
      setFieldValue('id', id)
      setFieldValue('firstName', firstName)
      setFieldValue('lastName', lastName)
      //setAvatar(obj.avatar)
      setLoading(false)
    }
  }, [route.params])

  const updateObj = async (input: UserT) => {
    try {
      await API.graphql(graphqlOperation(updateProfile, { input }))
      goBack(navigation)()
      setLoading(false)
    } catch (err) {
      setError(err)
    }
  }

  const _onPress = async (values: { firstName: string; lastName: string }): Promise<void> => {
    setLoading(true)
    // if (avatar.key === '') {
    //   setError('Pick a face')
    //   setLoading(false)
    // } else {
    const { firstName, lastName } = values
    const owner = await Auth.currentAuthenticatedUser()
    //const key = avatar.key
    // const fileForUpload = {
    //   bucket,
    //   key,
    //   region
    // }
    updateObj({ id: input.id, firstName, lastName, owner: owner.username })
    //}
  }

  // const onPressAva = async () => {
  //   const ava = await pickAva()
  //   const image = await updateImage(avatar.key, ava)
  //   setAvatar(image)
  // }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <>
      <AppContainer
        backgroundColor={dark ? black : white}
        onPress={goBack(navigation)}
        title=" "
        loading={loading}
        colorLeft={black}
      >
        <Space height={30} />
        <Formik
          innerRef={(r) => (formikRef.current = r || undefined)}
          initialValues={input}
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
              <Button title={I18n.t('done')} onPress={handleSubmit} color={black} />
            </>
          )}
        </Formik>
      </AppContainer>
    </>
  )
}
//<Avatar size="xLarge" avatar={avatar} onPress={onPressAva} loading={loading} />
export { UserEdit }
