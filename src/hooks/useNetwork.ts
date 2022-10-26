import NetInfo from '@react-native-community/netinfo'
import { useEffect } from 'react'
import { OpenNetworkModal } from '../constants'
import { DiceStore } from '../store'

export const useNetwork = () => {
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      if (state.isConnected === false && DiceStore.online) {
        OpenNetworkModal()
      }
    })
    return unsub
  }, [])
}
