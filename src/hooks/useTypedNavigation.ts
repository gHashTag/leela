import { RootStackParamList } from './../types';
import { NavigationProp, useNavigation } from "@react-navigation/native";

export const useTypedNavigation = useNavigation<NavigationProp<RootStackParamList>>
