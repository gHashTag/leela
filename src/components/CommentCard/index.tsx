import React from "react"
import { StyleSheet, View } from "react-native"
import { s, vs } from "react-native-size-matters"
import { CommentT } from "../../types"
import { Avatar } from "../Avatar"
import { Txt } from "../Txt"

interface CommentCardI {
    item: CommentT
    index: number
}

export const CommentCard: React.FC<CommentCardI> = ({
    item, index
}) => {

    return <View style={container}>
        <View style={{ flexDirection: 'row' }}>
            <Avatar size='small' viewStyle={avaS}
                uri={item.avatar} loading={false} />
            <Txt h6 title={`${item.firstName} ${item.lastName}`} />
        </View>
        <Txt title={`   ${item.text}`} />
    </View>
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: s(13),

    },
    avaS: {
        alignSelf: 'flex-start',
        paddingRight: s(5),
        paddingBottom: vs(7)
    }
})

const { container, avaS } = styles