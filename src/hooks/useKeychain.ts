import { useCallback, useState } from 'react'

import { EMAIL, PASSWORD } from '@env'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNetInfo } from '@react-native-community/netinfo'
import auth from '@react-native-firebase/auth'
import { useFocusEffect, useLinkTo } from '@react-navigation/native'
import * as Keychain from 'react-native-keychain'

import { useTypedNavigation } from './useTypedNavigation'

import { captureException } from '../constants'
import { onSignIn } from '../screens/helper'

export const useKeychain = () => {
  const { navigate } = useTypedNavigation()
  const [loading, setLoading] = useState<boolean>(true)
  const { isConnected } = useNetInfo()
  const linkTo = useLinkTo()

  /**
   * The credentials a development build may sign itself in with.
   *
   * They live in `.env`, which is not in the repository — `*.env` has been in
   * `.gitignore` since long before this — so a fresh clone has none and gets
   * the ordinary welcome screen. `__DEV__` decides it on its own as well: the
   * release build has neither the values nor this branch.
   *
   * Here rather than on the sign-in screen, because this is where signing in
   * already happens. The first attempt put it in `useSignIn`, and it never
   * ran: that hook is mounted by the *Sign In* screen, and an app that signs
   * itself in never opens one. Following the path the app already has also
   * means the dev sign-in ends where a real one does — `onSignIn(user, true,
   * linkTo)` — rather than in a second route that will drift from it.
   */
  const forTesting =
    __DEV__ && EMAIL && PASSWORD ? { username: EMAIL, password: PASSWORD } : null

  const key = useCallback(async (): Promise<void> => {
    try {
      // What was kept from a previous sign-in first: a developer who has signed
      // in as somebody else is not asking to be swapped back on every reload.
      const credentials = (await Keychain.getInternetCredentials('auth')) || forTesting
      if (credentials && isConnected) {
        const { username, password } = credentials
        await auth()
          .signInWithEmailAndPassword(username, password)
          .then(async (user) => {
            await onSignIn(user.user, true, linkTo)
          })
      } else if (isConnected !== null) {
        return Promise.reject()
      }
      isConnected !== null && setLoading(false)
    } catch (err) {
      captureException(err, 'key')
      isConnected !== null && setLoading(false)
      return Promise.reject()
    }
  }, [forTesting, isConnected, linkTo, setLoading])

  const checkGame = useCallback(async () => {
    const init = await AsyncStorage.getItem('@init')
    if (init === 'true') {
      navigate('MAIN')
    } else {
      setLoading(false)
    }
  }, [navigate, setLoading]) // Don't forget to add all dependencies here

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      key().catch(checkGame)
    }, [checkGame, key])
  )
  return { loading }
}
