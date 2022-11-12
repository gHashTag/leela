import { useFocusEffect } from '@react-navigation/native'
import { BackHandler } from 'react-native'

import { OpenExitModal } from '../constants'

export const useExitModal = () => {
  useFocusEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', function () {
      OpenExitModal()
      return true
    })
    return () => backHandler.remove()
  })
}
