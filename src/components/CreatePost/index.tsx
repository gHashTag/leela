import { StackNavigationProp } from "@react-navigation/stack"
import React from "react"
import { View } from "react-native"
import { RootStackParamList } from "../../types"

import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import { Button, Input, Space } from ".."
import { black, navigate } from "../../constants"
import { PostStore } from "../../store"
import { useNavigation } from "@react-navigation/native"

interface CreatePostT {
    plan: number
}

const schema = yup.object().shape({
    text: yup.string().trim().min(20).max(300).required()
}).required()

export const CreatePostScreen: React.FC<CreatePostT> = ({ plan }) => {

    const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
        methods.reset()
        await PostStore.createPost({ text: data.text, plan: plan })
        navigate('TAB_BOTTOM_4')
    }

    const { ...methods } = useForm({
        mode: 'onChange',
        resolver: yupResolver(schema)
    })

    return <View style={{ width: '90%' }}>
        <FormProvider {...methods}>
            <Input
                name="text"
                color={black}
                multiline

            />
            <Space height={20} />
            <Button title="Submit" onPress={methods.handleSubmit(handleSubmit, (err) => console.log(err))} />
        </FormProvider>
    </View>
}