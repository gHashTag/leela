import { NavigationProp, useNavigation } from '@react-navigation/native'

import { RootStackParamList } from '../types/types'

export const useTypedNavigation = useNavigation<
  NavigationProp<RootStackParamList>
>
