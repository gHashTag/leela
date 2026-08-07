import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'
import semver from 'semver'

import { OpenWhatsNewModal, captureException } from '../constants'
import { version } from '../../package.json'

const STORAGE_KEY = '@whatsNewLastSeenVersion'

export const useWhatsNewModal = () => {
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    const check = async () => {
      try {
        const lastSeen = await AsyncStorage.getItem(STORAGE_KEY)
        if (lastSeen && semver.lt(lastSeen, version)) {
          OpenWhatsNewModal()
        }
        await AsyncStorage.setItem(STORAGE_KEY, version)
      } catch (error) {
        captureException(error as Error, 'useWhatsNewModal: check')
      }
    }

    check()
  }, [])
}
