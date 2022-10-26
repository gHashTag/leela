import { useFocusEffect } from '@react-navigation/native'
import { BackHandler } from 'react-native'

export const useNoBackHandler = () => {
  useFocusEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return sub.remove
  })
}
