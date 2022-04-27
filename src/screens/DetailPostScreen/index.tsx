import { RouteProp } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { FlatList, TouchableOpacity } from "react-native-gesture-handler"
import { CommentCard, Header, Input, PostCard, Space, Txt } from "../../components"
import { black, brightTurquoise, fuchsia, goBack, gray, lightGray, secondary } from "../../constants"
import { PostStore } from "../../store"
import { RootStackParamList } from "../../types"

import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import { s, vs } from "react-native-size-matters"
import { nanoid } from "nanoid/non-secure"
import { observer } from "mobx-react-lite"

interface DetailPostI {
    navigation: StackNavigationProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
    route: RouteProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
}

const schema = yup.object().shape({
    text: yup.string().trim().required().min(10).max(200)
}).required()

export const DetailPostScreen: React.FC<DetailPostI> = observer(({
    navigation, route
}) => {
    const hookForn = useForm({
        mode: 'onChange',
        resolver: yupResolver(schema)
    })
    const { item, index } = route.params

    const onSubmit: SubmitHandler<FieldValues> = (data) => {
        PostStore.createComment({
            text: data.text, postId: item.id,
            postOwner: item.ownerId
        })
        methods.reset()
    }
    const { ...methods } = hookForn

    const data = PostStore.store.comments.filter(a => a.postId === item.id)

    return <>
        <FlatList
            ListHeaderComponent={<>
                <Header iconLeft=':back:' onPress={goBack(navigation)} />
                <PostCard item={item} index={index} isDetail />
                {/* <Space height={vs(10)} />
                <FormProvider {...methods} >
                    <View style={inputCont}>
                        <View style={bordered} />
                        <View style={paddingInput} >
                            <Input placeholder="Your comment"
                                showError={false} name="text"
                                color={black} additionalStyle={{ flex: 1 }} />
                            <Pressable style={({ pressed }) =>
                                [{ opacity: pressed ? .7 : 1 }]}
                                onPress={methods.handleSubmit(onSubmit,
                                    (err) => console.log(err))} >
                                <Txt h1 title="Send" />
                            </Pressable>
                        </View>
                    </View>
                </FormProvider>
                <Space height={vs(25)} /> */}
                <View style={line} />
            </>}
            ListFooterComponent={<>
            <View style={line} />
            <Space height={vs(30)} />
            </>}
            keyExtractor={() => nanoid(9)}
            ListEmptyComponent={<>
                <Space height={vs(10)} />
                <Txt h4 title="No comments yet" />
            </>}
            data={data}
            renderItem={({ item, index }) => <CommentCard item={item} index={index} endIndex={data.length - 1} />}
        />
    </>
})

const style = StyleSheet.create({
    inputCont: {
        marginHorizontal: s(12),
        borderColor: brightTurquoise,
        borderWidth: s(1)
    },
    bordered: {
        width: '100%',
        height: '100%',
        borderColor: fuchsia,
        borderWidth: s(1),
        transform: [{ translateX: s(-4) }, { translateY: vs(-4) }],
        position: 'absolute',
        opacity: 0.6
    },
    paddingInput: {
        padding: s(10),
        paddingTop: s(2),
        flexDirection: 'row',
        alignItems: 'center'
    },
    line: {
        width: '100%',
        borderBottomColor: lightGray,
        borderBottomWidth: vs(1)
    }
})

const { inputCont, bordered, paddingInput, line } = style