import React from "react"
import { StyleProp, TouchableOpacity, ViewStyle, useColorScheme } from "react-native"
import Icon from "react-native-vector-icons/FontAwesome"
import { dimGray, white, } from "../../constants"

interface ButtonVectorIconI {
    name: string
    size: number
    color?: string
    onPress?: () => void
    viewStyle?: StyleProp<ViewStyle>
}

export function ButtonVectorIcon({
    name, onPress, size, color, viewStyle
}: ButtonVectorIconI) {
    const scheme = useColorScheme()
    return <TouchableOpacity style={viewStyle} onPress={onPress} activeOpacity={.7}>
        <Icon name={name} size={size} color={color ? color : scheme === 'dark' ? white : dimGray} />
    </TouchableOpacity>
}