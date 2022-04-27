import React, { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { s, vs } from "react-native-size-matters"
import { brightTurquoise, classicRose, fuchsia, gray, lightGray, W } from "../../constants"
import { PostT } from "../../types"
import { ButtonVectorIcon } from "../"
import { Txt } from "../Txt"
import { Space } from "../Space"
import { useNavigation } from "@react-navigation/native"
import { AllLang } from "../../utils"
import auth from '@react-native-firebase/auth'
import { PlanAvatar } from "../PLanAvatar"
import { TextCopy } from "../TextCopy"
import { PostStore } from "../../store"

interface postCardI {
    item: PostT
    index: number
    isDetail?: boolean
}

export const PostCard: React.FC<postCardI> = ({
    item, index, isDetail = false
}) => {
    const { navigate } = useNavigation()
    const [transText, setTransText] = useState('')
    const [isLiked, setIsLiked] = useState<boolean>(
        item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true)

    useMemo(() => {
        setIsLiked(item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true)
    }, [item.liked])

    let date: string | Date = new Date(item.createTime)
    const dateNow = Date.now()
    if (item.createTime >= dateNow - 86400000) {
        date = 'today'
    } else if (isDetail) {
        date = `${date.getHours()}:${date.getMinutes()} · ${date.getDate()}/${date.getMonth()}/${date.getFullYear().toString().substr(2, 2)}`
    } else if (item.createTime >= dateNow - 86400000 * 2) {
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

    const smallButton = (W / 4) - s(70)
    const mediunButton = (W / 4) - s(66)

    async function handleLike() {
        setIsLiked(true)
        !isLiked && await PostStore.likePost(item.id)
    }

    const heart = isLiked ? 'heart' : 'heart-o'
    const heartColor = isLiked ? classicRose : undefined

    return <Pressable onPress={() => { !isDetail && goDetail() }} style={[container, isDetail && { borderBottomWidth: 0 }]}>
        <View style={{ flexDirection: 'row' }}>
            <PlanAvatar size={isDetail ? 'large' : 'medium'} plan={item.plan} aditionalStyle={img} />
            <View style={{ flexDirection: 'column', flex: 1 }} >
                {/* name, create date/email */}
                <Space height={vs(2)} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Txt numberOfLines={1} textAlign='left' h6 title={`${item.firstName} ${item.lastName}`} />
                    {!isDetail ? <Txt textAlign='left' h6 textStyle={{ color: lightGray }} title={`  ·  ${date}`} />
                        :
                        <Txt textAlign='left' h6 textStyle={{ color: lightGray }}
                            title={`${item.email}`} />}
                </View>
                <Space height={vs(5)} />
                {!isDetail && <Pressable style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <TextCopy numberOfLines={8} h6 title={`${transText ? transText : item.text}`} />
                </Pressable>}
                {!isDetail &&
                    /* Preview Buttons */
                    <View style={btnsContainer}>
                        <ButtonVectorIcon viewStyle={smallBtn} name='comment-o' size={smallButton} />
                        <ButtonVectorIcon viewStyle={smallBtn} name='compress' size={smallButton} />
                        <ButtonVectorIcon count={item.liked?.length} onPress={handleLike} color={heartColor} viewStyle={smallBtn} name={heart} size={smallButton} />
                        <ButtonVectorIcon viewStyle={smallBtn} name='external-link' size={smallButton} />
                    </View>}
            </View>
        </View>
        {isDetail && <>
            {/* Detail Text */}
            <Pressable style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TextCopy h6 title={`${transText ? transText : item.text}`} />
            </Pressable>
            {/* Detail Date */}
            <Space height={vs(5)} />
            <Txt textAlign='left' h6 textStyle={{ color: lightGray }} title={`${date}`} />
            <View style={countersContainer}>
                <Txt h6 title={`${item.liked?.length}  `} />
                <Txt textStyle={{color: gray}} h6 title={`Like${item.liked && item.liked.length > 1 ? 's' : ''}`} />
            </View>
            {/* Detail Buttons */}
            <View style={btnsContainer}>
                <ButtonVectorIcon viewStyle={mediumBtn} name='comment-o' size={mediunButton} />
                <ButtonVectorIcon viewStyle={mediumBtn} name='compress' size={mediunButton} />
                <ButtonVectorIcon onPress={handleLike} viewStyle={mediumBtn} color={heartColor} name={heart} size={mediunButton} />
                <ButtonVectorIcon viewStyle={mediumBtn} name='external-link' size={mediunButton} />
            </View>
        </>}
    </Pressable>
}

const style = StyleSheet.create({
    container: {
        paddingLeft: s(12),
        paddingRight: s(12),
        marginRight: s(12),
        borderBottomColor: brightTurquoise,
        borderBottomWidth: vs(1),
        paddingVertical: s(6)
    },
    img: {
        marginRight: s(12),
        marginBottom: s(12),
        alignSelf: 'flex-start',
    },
    btnsContainer: {
        flexDirection: 'row',
        padding: s(4),
        paddingBottom: vs(12),
        paddingTop: vs(17),
        flex: 1
    },
    mediumBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    smallBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    countersContainer: {
        flexDirection: 'row',
        paddingVertical: vs(9),
        marginHorizontal: s(8),
        borderColor: fuchsia,
        borderBottomWidth: s(1),
        borderTopWidth: s(1),
        flex: 1,
        marginTop: vs(11),
        paddingHorizontal: s(5)
    },
})

const { container, img, btnsContainer, smallBtn, mediumBtn, countersContainer } = style