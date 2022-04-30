import React, { useState, ReactElement } from 'react'
import * as Keychain from 'react-native-keychain'
import { I18n } from '../../../utils'
import { useTheme } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Button } from '../../../components'
import { black, goHome, white } from '../../../constants'
import { RootStackParamList } from '../../../types'
import auth from '@react-native-firebase/auth'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HELLO'>

type UserT = {
  navigation: ProfileScreenNavigationProp
}

const User = ({ navigation }: UserT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const _onPress = async (): Promise<void> => {
    setLoading(true)
    try {
      await auth().signOut()
      await Keychain.resetInternetCredentials('auth')
      goHome(navigation)()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <AppContainer loading={loading}>
      <Button title={I18n.t('signOut')} onPress={_onPress} />
    </AppContainer>
  )
}

export { User }
