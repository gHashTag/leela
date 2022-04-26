import React, { useEffect, useState } from "react"
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native"
import { s, vs } from "react-native-size-matters"
import { brightTurquoise, fuchsia, lightGray } from "../../constants"
import { PostT } from "../../types"
import { Avatar, ButtonVectorIcon } from "../"
import { Txt } from "../Txt"
import { Space } from "../Space"
import { useNavigation } from "@react-navigation/native"
import { AllLang } from "../../utils"
import { EmojiText } from "../EmojiText"
import { PlanAvatar } from "../PLanAvatar"

interface postCardI {
    item: PostT
    index: number
    hideButton?: boolean
}

export const PostCard: React.FC<postCardI> = ({
    item, index, hideButton
}) => {
    const { navigate } = useNavigation()
    const [transText, setTransText] = useState('')

    let date: string | Date = new Date(item.createTime)
    const dateNow = Date.now()
    if (item.createTime >= dateNow - 86400000) {
        date = 'yesterday'
    } else if (dateNow - item.createTime < 10 * 86400000) {
        const days = Math.floor((dateNow - item.createTime) / 86400000)
        date = `${days} days ago`
    } else {
        date = `${date.getDate()}.${date.getMonth()}.${date.getFullYear()}`
    }

    function goDetail() {
        navigate('DETAIL_POST_SCREEN', { item, index })
    }

    return <View style={container}>
        <PlanAvatar size='medium' plan={42} aditionalStyle={img} />
        <View style={{ flexDirection: 'column', flex: 1 }} >
            <Space height={vs(2)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Txt numberOfLines={1} textAlign='left' h6 title={`${item.firstName} ${item.lastName}`} />
                <Txt textAlign='left' h6 textStyle={{ color: lightGray }} title={`  ·  ${date}`} />
            </View>
            <Space height={vs(5)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Txt numberOfLines={8} textAlign='left' h6 title={`${transText ? transText : item.text}`} />
            </View>
            <View style={btnsContainer}>
                <ButtonVectorIcon viewStyle={{ flex: 1 }} name='comment-o' size={s(20)} />
                <ButtonVectorIcon viewStyle={{ flex: 1 }} name='compress' size={s(20)} />
                <ButtonVectorIcon viewStyle={{ flex: 1 }} name='heart-o' size={s(20)} />
                <ButtonVectorIcon viewStyle={{ flex: 1 }} name='external-link' size={s(20)} />
            </View>
        </View>
    </View>
}

const style = StyleSheet.create({
    container: {
        paddingLeft: s(12),
        paddingRight: s(12),
        marginRight: s(12),
        borderBottomColor: brightTurquoise,
        borderBottomWidth: vs(1),
        paddingVertical: s(12),
        flexDirection: 'row'
    },
    img: {
        marginRight: s(12),
        marginBottom: s(12),
        alignSelf: 'flex-start',
    },
    btnsContainer: {
        flexDirection: 'row',
        padding: s(4),
        paddingBottom: vs(20),
        paddingTop: vs(17)
    },

})

const { container, img, btnsContainer } = style