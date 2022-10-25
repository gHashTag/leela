import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import {
  brightTurquoise,
  classicRose,
  fuchsia,
  gray,
  lightGray,
  W
} from '../../constants'
import { PostT } from '../../types'
import { ButtonVectorIcon } from '../'
import { Text } from '../'
import { Space } from '../Space'
import { useNavigation } from '@react-navigation/native'
import auth from '@react-native-firebase/auth'
// import { PlanAvatar } from '../PlanAvatar'
import { PostStore } from '../../store'
import { observer } from 'mobx-react-lite'

interface postCardI {
  item: PostT
  index: number
  isDetail?: boolean
  onPressCom?: () => void
}

export const PostCard: React.FC<postCardI> = observer(
  ({ item, index, isDetail = false, onPressCom }) => {
    const { navigate } = useNavigation()
    const [transText, setTransText] = useState('')
    const [isLiked, setIsLiked] = useState<boolean>(
      item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true
    )

    useMemo(() => {
      setIsLiked(
        item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true
      )
    }, [item.liked])

    const likeCount = PostStore.store.posts[index].liked?.length

    let date: string | Date = new Date(item.createTime)
    const dateNow = Date.now()
    if (item.createTime >= dateNow - 86400000) {
      date = 'today'
    } else if (isDetail) {
      date = `${date.getHours()}:${date.getMinutes()} · ${date.getDate()}/${date.getMonth()}/${date
        .getFullYear()
        .toString()
        .substr(2, 2)}`
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

    const smallButton = W / 4 - s(70)
    const mediunButton = W / 4 - s(66)

    async function handleLike() {
      setIsLiked(true)
      !isLiked && (await PostStore.likePost(item.id))
    }

    function handleComment() {
      onPressCom && onPressCom()
    }

    const heart = isLiked ? 'heart' : 'heart-o'
    const heartColor = isLiked ? classicRose : undefined
    const fullName = PostStore.getOwnerName(item.ownerId)

    if (isDetail)
      return (
        <View style={[container, { borderBottomWidth: 0 }]}>
          <View style={{ flexDirection: 'row' }}>
            {/* <PlanAvatar size={'large'} plan={item.plan} aditionalStyle={img} /> */}
            <View style={{ flexDirection: 'column', flex: 1 }}>
              {/* name, create date/email */}
              <Space height={vs(2)} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Text numberOfLines={1} h={'h6'} title={fullName} />
              </View>
              <Text h={'h6'} textStyle={{ color: lightGray }} title={`${item.email}`} />
              <Space height={vs(5)} />
            </View>
          </View>
          {/* Detail Text */}
          <Text h={'h5'} title={`${item.text}`} selectable />
          {/* Detail Date */}
          <Space height={vs(5)} />
          <Text
            h={'h5'}
            textStyle={{ color: lightGray, textAlign: 'left' }}
            title={`${date}`}
          />
          <View style={countersContainer}>
            <Text h={'h6'} title={`${likeCount}  `} />
            <Text
              textStyle={{ color: gray }}
              h={'h6'}
              title={`Like${likeCount && likeCount > 1 ? 's' : ''}`}
            />
          </View>
          {/* Detail Buttons */}
          <View style={btnsContainer}>
            <ButtonVectorIcon
              onPress={handleComment}
              viewStyle={mediumBtn}
              name="comment-o"
              size={mediunButton}
            />
            <ButtonVectorIcon viewStyle={mediumBtn} name="compress" size={mediunButton} />
            <ButtonVectorIcon
              onPress={handleLike}
              viewStyle={mediumBtn}
              color={heartColor}
              name={heart}
              size={mediunButton}
            />
            <ButtonVectorIcon
              viewStyle={mediumBtn}
              name="external-link"
              size={mediunButton}
            />
          </View>
        </View>
      )

    return (
      <Pressable onPress={goDetail} style={container}>
        <View style={{ flexDirection: 'row' }}>
          <PlanAvatar size={'medium'} plan={item.plan} aditionalStyle={img} />
          <View style={{ flexDirection: 'column', flex: 1 }}>
            {/* name, create date/email */}
            <Space height={vs(2)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Text numberOfLines={1} h={'h6'} title={fullName} />
              <Text h={'h6'} textStyle={{ color: lightGray }} title={`  ·  ${date}`} />
            </View>
            <Space height={vs(5)} />
            <Text numberOfLines={8} h={'h5'} title={`${item.text}`} />
            {/* Preview Buttons */}
            <View style={btnsContainer}>
              <ButtonVectorIcon
                onPress={handleComment}
                viewStyle={smallBtn}
                name="comment-o"
                size={smallButton}
              />
              <ButtonVectorIcon viewStyle={smallBtn} name="compress" size={smallButton} />
              <ButtonVectorIcon
                count={item.liked?.length}
                onPress={handleLike}
                color={heartColor}
                viewStyle={smallBtn}
                name={heart}
                size={smallButton}
              />
              <ButtonVectorIcon
                viewStyle={smallBtn}
                name="external-link"
                size={smallButton}
              />
            </View>
          </View>
        </View>
      </Pressable>
    )
  }
)
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
    alignSelf: 'flex-start'
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
    alignItems: 'center'
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
  }
})

const { container, img, btnsContainer, smallBtn, mediumBtn, countersContainer } = style
