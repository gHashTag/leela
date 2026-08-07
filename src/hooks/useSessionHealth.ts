import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

import { captureException } from '../constants'
import {
  CrashFreeSessionStatus,
  loadSessionHealth,
  SessionHealth
} from '../utils/sessionHealth'

export const useSessionHealth = () => {
  const [health, setHealth] = useState<SessionHealth>({
    startedAt: 0,
    status: 'unknown'
  })
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    loadSessionHealth()
      .then((h) => {
        if (mounted) setHealth(h)
      })
      .catch((error) => captureException(error, 'useSessionHealth: load'))

    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false)
    })

    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return { ...health, isOnline }
}

export type { CrashFreeSessionStatus, SessionHealth }
