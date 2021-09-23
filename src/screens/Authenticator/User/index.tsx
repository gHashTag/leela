import React, { useState, useEffect, ReactElement } from 'react'
import { Auth } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import { I18n } from '../../../utils'
import { useTheme } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Button } from '../../../components'
import { black, goHome, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HELLO'>

type UserT = {
  navigation: ProfileScreenNavigationProp
}

const User = ({ navigation }: UserT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkUser = async (): Promise<void> => {
      await Auth.currentAuthenticatedUser()
    }
    checkUser()
  }, [navigation])

  const _onPress = async (): Promise<void> => {
    setLoading(true)
    try {
      await Auth.signOut()
      await Keychain.resetInternetCredentials('auth')
      goHome(navigation)()
    } catch (err) {
      setError(err.message)
    }
  }
  const { dark } = useTheme()
  return (
    <AppContainer backgroundColor={dark ? black : white} loading={loading}>
      <Button title={I18n.t('signOut')} onPress={_onPress} />
    </AppContainer>
  )
}

export { User }
