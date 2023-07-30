import { NavigationProp, useNavigation } from '@react-navigation/native'

import { RootStackParamList } from './../types'

export const useTypedNavigation = useNavigation<
  NavigationProp<RootStackParamList>
>
