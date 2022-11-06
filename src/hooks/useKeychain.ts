import { useCallback, useState } from 'react'
import * as Keychain from 'react-native-keychain'
import auth from '@react-native-firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'
import { useNetInfo } from '@react-native-community/netinfo'
import { useFocusEffect } from '@react-navigation/native'
import { onSignIn } from '../screens/helper'
import { useTypedNavigation } from './useTypedNavigation'

export const useKeychain = () => {
  const { navigate } = useTypedNavigation()
  const [loading, setLoading] = useState<boolean>(true)
  const { isConnected } = useNetInfo()

  const key = async (): Promise<void> => {
    try {
      const credentials = await Keychain.getInternetCredentials('auth')
      if (credentials && isConnected) {
        const { username, password } = credentials
        await auth()
          .signInWithEmailAndPassword(username, password)
          .then(async user => {
            await onSignIn(user.user, true)
          })
      } else if (isConnected !== null) {
        return Promise.reject()
      }
      isConnected !== null && setLoading(false)
    } catch (err) {
      captureException(err)
      isConnected !== null && setLoading(false)
      return Promise.reject()
    }
  }

  const checkGame = async () => {
    const init = await AsyncStorage.getItem('@init')
    if (init === 'true') {
      navigate('MAIN')
    } else {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      key().catch(checkGame)
    }, [isConnected])
  )
  return { loading }
}
