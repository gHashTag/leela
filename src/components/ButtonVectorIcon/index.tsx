import React from "react"
import { StyleProp, TouchableOpacity, ViewStyle, useColorScheme } from "react-native"
import { s } from "react-native-size-matters"
import Icon from "react-native-vector-icons/FontAwesome"
import { dimGray, white, } from "../../constants"
import { Space } from "../Space"
import { Txt } from "../Txt"

interface ButtonVectorIconI {
    name: string
    size: number
    color?: string
    onPress?: () => void
    viewStyle?: StyleProp<ViewStyle>
    count?: number
}

export function ButtonVectorIcon({
    name, onPress, size, color, viewStyle, count
}: ButtonVectorIconI) {
    const scheme = useColorScheme()
    const colorTheme = scheme === 'dark' ? white : dimGray
    return <TouchableOpacity style={viewStyle} onPress={onPress} activeOpacity={.7}>
        <Icon name={name} size={size} color={color ? color : colorTheme} />
        <Space width={s(5)} />
        {count && <Txt title={`${count}`} h6 textStyle={{ fontSize: size, color: colorTheme }} />}
    </TouchableOpacity>
}
