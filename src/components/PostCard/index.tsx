import React, { useState } from "react"
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native"
import { s, vs } from "react-native-size-matters"
import { brightTurquoise, fuchsia } from "../../constants"
import { OnlinePlayerStore } from "../../store"
import { PostT } from "../../types"
import { Avatar } from "../"
import { Txt } from "../Txt"
import { Space } from "../Space"
import { useNavigation } from "@react-navigation/native"

interface postCardI {
    item: PostT
    index: number
    hideButton?: boolean
}

export const PostCard: React.FC<postCardI> = ({
    item, index, hideButton
}) => {
    const { navigate } = useNavigation()
    const [size, setSize] = useState({ height: 0, width: 0 })

    const _onLayout = (ev: LayoutChangeEvent) => {
        const { height, width } = ev.nativeEvent.layout
        setSize({ height, width })
    }

    return <View style={container} onLayout={_onLayout}>
        <View style={[border, size]} />
        <View style={{ flexDirection: 'row' }}>
            <Avatar size='small' viewStyle={img}
                uri={OnlinePlayerStore.avatar} loading={false} />
            <View style={{ flex: 1 }}>
                <Space height={vs(5)} />
                <Txt textAlign='left' h1 title={`${item.firstName} ${item.lastName}`} />
            </View>
        </View>
        <Txt textAlign='left' h3 title={`    ${item.text}`} />
        <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                {!hideButton &&
                    <Pressable onPress={() => navigate('DETAIL_POST_SCREEN', { item, index })}>
                        <Txt textStyle={{ textDecorationLine: 'underline' }}
                            textAlign="left" title="Show comments" h8 />
                    </Pressable>}
                <Space height={vs(10)} />
            </View>
            <Txt textStyle={planS} h0 title={item.plan.toString()} />
        </View>
    </View>
}

const style = StyleSheet.create({
    container: {
        paddingVertical: vs(5),
        borderColor: brightTurquoise,
        borderWidth: vs(1),
        paddingHorizontal: s(10),
        marginHorizontal: s(20),
        marginVertical: vs(10),
    },
    img: {
        marginRight: s(8),
        marginBottom: s(8),
        marginTop: vs(6),
        alignSelf: 'flex-start',
    },
    border: {
        borderWidth: s(1),
        position: 'absolute',
        borderColor: fuchsia,
        transform: [{ translateX: s(-4) }, { translateY: vs(-4) }],
        opacity: 0.6
    },
    planS: {
        padding: s(4),
        paddingTop: s(1)
    }
})

const { container, img, border, planS } = style