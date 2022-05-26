import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, Share, StyleSheet, TouchableOpacity, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import {
  brightTurquoise,
  classicRose,
  fuchsia,
  gray,
  lightGray,
  W,
  navigate
} from '../../../constants'
import { Text, Space, ButtonVectorIcon, PlanAvatar } from '../../'
import auth from '@react-native-firebase/auth'
import { PostStore } from '../../../store'
import { observer } from 'mobx-react-lite'
import { HashtagFormat } from '../../TextComponents'
import { getTimeStamp, getUid } from '../../../screens/helper'
import { buildLink, lang } from '../../../utils'
import { EmojiText } from '../../EmojiText'

interface postCardI {
  postId: string
  isDetail?: boolean
  onPressCom?: () => void
}

export const PostCard: React.FC<postCardI> = observer(props => {
  const { postId, isDetail = false, onPressCom } = props

  const item = PostStore.store.posts.find(a => a.id === postId)
  if (!item) {
    return <Text title="Not found" h="h1" />
  }
  const itemIndex = PostStore.store.posts.findIndex(a => a.id === postId)
  const [isLiked, setIsLiked] = useState<boolean>(
    item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true
  )
  const [transText, setTransText] = useState('')
  useEffect(() => {
    setTransText(item.text)
  }, [])

  useMemo(() => {
    setIsLiked(
      item.liked?.findIndex(a => a === auth().currentUser?.uid) === -1 ? false : true
    )
  }, [item.liked])

  const likes = PostStore.store.posts[itemIndex].liked
  const likeCount = likes?.filter(a => a !== item.ownerId).length

  const date = getTimeStamp({ lastTime: item.createTime })

  function goDetail() {
    item && navigate('DETAIL_POST_SCREEN', { postId: item.id })
  }

  const smallButton = W / 4 - s(70)
  const mediumButton = W / 4 - s(66)

  async function handleLike() {
    if (item) {
      setIsLiked(true)
      if (!isLiked) {
        await PostStore.likePost(item.id)
        const uid = getUid()
        !likes?.includes(item.ownerId) && likes?.push(uid ? uid : '')
      }
    }
  }

  function handleTranslate() {}

  function handleComment() {
    onPressCom && onPressCom()
    if (!isDetail) {
      item && navigate('DETAIL_POST_SCREEN', { postId: item.id, comment: true })
    }
  }

  async function handleShareLink() {
    // @ts-expect-error
    const dynamicLink = await buildLink(`/detail_post/${item.id}`)
    if (typeof dynamicLink === 'string') {
      Share.share({
        title: 'Leela Chakra',
        message: dynamicLink
      })
    }
  }

  const heart = isLiked ? 'heart' : 'heart-o'
  const heartColor = isLiked ? classicRose : undefined
  const fullName = PostStore.getOwnerName(item.ownerId)
  const avaUrl = PostStore.getAvaById(item.ownerId)
  const flag = lang === 'en' ? ':us:' : `:${lang}:`
  if (isDetail)
    return (
      <View style={[container, { borderBottomWidth: 0 }]}>
        <View style={headerS}>
          <PlanAvatar
            avaUrl={avaUrl}
            size={'large'}
            plan={item.plan}
            aditionalStyle={img}
          />
          <View style={headerInfo}>
            {/* name, create date */}
            <Space height={vs(2)} />
            <View style={headerName}>
              <Text numberOfLines={1} h={'h6'} title={fullName} />
            </View>
            <Text h={'h6'} textStyle={lightText} title={`${item.email}`} />
            <Space height={vs(5)} />
          </View>
        </View>
        {/* Detail Text */}
        <HashtagFormat h={'h5'} textStyle={textStyle} title={transText} selectable />
        {/* Detail Date */}
        <Space height={vs(5)} />
        <View style={headerS}>
          <Text h={'h5'} textStyle={lightText} title={`${date}`} />
          <View style={flex1} />
          <TouchableOpacity onPress={handleTranslate}>
            <EmojiText name={flag} fontSize={s(18)} />
          </TouchableOpacity>
        </View>
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
            size={mediumButton}
          />
          <ButtonVectorIcon viewStyle={mediumBtn} name="compress" size={mediumButton} />
          <ButtonVectorIcon
            onPress={handleLike}
            viewStyle={mediumBtn}
            color={heartColor}
            name={heart}
            size={mediumButton}
          />
          <ButtonVectorIcon
            viewStyle={mediumBtn}
            name="external-link"
            onPress={handleShareLink}
            size={mediumButton}
          />
        </View>
      </View>
    )
  return (
    <Pressable onPress={goDetail} style={container}>
      <View style={headerS}>
        <PlanAvatar
          avaUrl={avaUrl}
          size={'medium'}
          plan={item.plan}
          aditionalStyle={img}
        />
        <View style={headerInfo}>
          {/* name, create date/email */}
          <Space height={vs(2)} />
          <View style={headerName}>
            <Text numberOfLines={1} h={'h6'} title={fullName} />
            <Text h={'h6'} textStyle={lightText} title={`  ·  ${date}`} />
            <View style={flex1} />
            <TouchableOpacity onPress={handleTranslate}>
              <EmojiText name={flag} fontSize={s(18)} />
            </TouchableOpacity>
          </View>
          <Space height={vs(5)} />
          <HashtagFormat
            textStyle={textStyle}
            numberOfLines={8}
            h={'h5'}
            title={transText}
          />
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
              count={likeCount}
              onPress={handleLike}
              color={heartColor}
              viewStyle={smallBtn}
              name={heart}
              size={smallButton}
            />
            <ButtonVectorIcon
              viewStyle={smallBtn}
              name="external-link"
              onPress={handleShareLink}
              size={smallButton}
            />
          </View>
        </View>
      </View>
    </Pressable>
  )
})
const style = StyleSheet.create({
  container: {
    paddingLeft: s(12),
    paddingRight: s(12),
    borderBottomColor: brightTurquoise,
    borderBottomWidth: vs(0.4),
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
  },
  textStyle: {
    lineHeight: vs(20)
  },
  headerS: {
    flexDirection: 'row'
  },
  headerInfo: {
    flexDirection: 'column',
    flex: 1
  },
  headerName: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  lightText: {
    color: lightGray,
    textAlign: 'left'
  },
  flex1: {
    flex: 1
  }
})

const {
  container,
  img,
  btnsContainer,
  smallBtn,
  mediumBtn,
  countersContainer,
  textStyle,
  headerS,
  headerInfo,
  headerName,
  lightText,
  flex1
} = style
