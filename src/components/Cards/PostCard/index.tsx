import React, { useEffect, useState } from 'react'
import { Pressable, Share, StyleSheet, TouchableOpacity, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import {
  brightTurquoise,
  fuchsia,
  lightGray,
  W,
  navigate,
  OpenReplyModal,
  orange
} from '../../../constants'
import { Text, Space, ButtonVectorIcon, PlanAvatar } from '../../'
import { OnlinePlayer, PostStore } from '../../../store'
import { observer } from 'mobx-react-lite'
import { HashtagFormat } from '../../TextComponents'
import { getTimeStamp, getUid } from '../../../screens/helper'
import { I18n, lang } from '../../../utils'
import { EmojiText } from '../../EmojiText'
import { getActions } from './ModalActions'
import { buildReportLink } from '../../../utils/linkHelpers'

interface postCardI {
  postId: string
  isDetail?: boolean
  translatedText?: string
  isHideTranslate?: boolean
  onPressCom?: () => void
}

export const PostCard: React.FC<postCardI> = observer(props => {
  const { postId, isDetail = false, onPressCom, translatedText, isHideTranslate } = props

  const item = PostStore.store.posts.find(a => a.id === postId)
  if (!item) {
    return <Text title="Not found" h="h1" />
  }
  const [transText, setTransText] = useState('')
  const [hideTranslate, setHideTranslate] = useState(true)
  const isLiked = item.liked?.findIndex(a => a === getUid()) === -1 ? false : true

  useEffect(() => {
    if (translatedText) {
      setTransText(translatedText)
      setHideTranslate(Boolean(isHideTranslate))
    }
  }, [])

  const likeCount = item.liked?.length
  const commCount = item.comments?.length

  const date = getTimeStamp({ lastTime: item.createTime })

  function goDetail() {
    item &&
      navigate('DETAIL_POST_SCREEN', {
        postId: item.id,
        translatedText: transText,
        hideTranslate
      })
  }

  const iconSize = W / 4 - s(72)

  async function handleLike() {
    if (item && isLiked) {
      await PostStore.unlikePost(item.id)
    } else if (item && !isLiked) {
      await PostStore.likePost(item.id)
    }
  }
  const text = hideTranslate ? item.text : transText

  async function handleTranslate() {
    if (item?.text) {
      if (hideTranslate && transText === '') {
        const translated = await PostStore.translateText(item?.text)
        setTransText(translated)
      }
      setHideTranslate(pr => !pr)
    }
  }

  function handleComment() {
    onPressCom && onPressCom()
    if (!isDetail) {
      item && navigate('DETAIL_POST_SCREEN', { postId: item.id, comment: true })
    }
  }

  async function handleShareLink() {
    const { id, text } = item || {}
    if (id && text) {
      const deepLink = await buildReportLink(id, text)
      Share.share({
        title: 'Leela Chakra',
        message: deepLink
      })
    }
  }

  const isAdmin = OnlinePlayer.store.status === 'Admin'
  const handleAdminMenu = () => {
    const modalButtons = getActions({ isDetail, item })
    OpenReplyModal(modalButtons)
  }

  const heart = isLiked ? 'heart' : 'heart-outline'
  const heartColor = isLiked ? fuchsia : undefined

  const fullName = PostStore.getOwnerName(item.ownerId)
  const avaUrl = PostStore.getAvaById(item.ownerId)

  const flag = hideTranslate
    ? lang === 'en'
      ? ':us:'
      : `:${lang}:`
    : item.language === 'en'
    ? ':us:'
    : `:${item.language}:`

  if (isDetail)
    return (
      <View style={[container, { borderBottomWidth: 0 }]}>
        <View style={headerS}>
          <PlanAvatar
            avaUrl={avaUrl}
            size={'large'}
            isAccept={item.accept}
            plan={item.plan}
            aditionalStyle={img}
          />
          <View style={headerInfo}>
            {/* name, create date */}
            <Space height={vs(6.5)} />
            <View style={headerName}>
              <Text numberOfLines={1} h={'h6'} title={fullName} />
            </View>
            <Text h={'h5'} numberOfLines={1} textStyle={lightText} title={`${date}`} />
            <Space height={vs(5)} />
          </View>
          <TouchableOpacity onPress={handleTranslate}>
            <EmojiText name={flag} fontSize={s(18)} />
          </TouchableOpacity>
        </View>
        {/* Detail Text */}
        <HashtagFormat h={'h5'} textStyle={textStyle} title={text} selectable />
        {/* Detail Date */}
        <Space height={vs(5)} />
        <View style={headerS}>
          <View style={flex1} />
        </View>
        {/* Detail Buttons */}
        <View style={btnsContainer}>
          {isAdmin && (
            <ButtonVectorIcon
              onPress={handleAdminMenu}
              viewStyle={mediumBtn}
              ionicons
              iconSize={iconSize + s(3)}
              name="md-ellipsis-vertical-circle"
              size={iconSize}
            />
          )}
          <ButtonVectorIcon
            count={commCount}
            onPress={handleComment}
            viewStyle={mediumBtn}
            ionicons
            name="chatbubble-outline"
            size={iconSize}
          />
          <ButtonVectorIcon
            count={likeCount}
            onPress={handleLike}
            viewStyle={mediumBtn}
            color={heartColor}
            iconSize={iconSize + s(3)}
            ionicons
            name={heart}
            size={iconSize}
          />
          <ButtonVectorIcon
            viewStyle={mediumBtn}
            iconSize={iconSize + s(7)}
            ionicons
            name="md-link-outline"
            onPress={handleShareLink}
          />
        </View>
      </View>
    )
  return (
    <Pressable onPress={goDetail} style={container}>
      <View style={headerS}>
        <View style={avaContainer}>
          <PlanAvatar
            avaUrl={avaUrl}
            size={'medium'}
            plan={item.plan}
            isAccept={item.accept}
            aditionalStyle={img}
          />
          {isAdmin && (
            <>
              <ButtonVectorIcon
                onPress={handleAdminMenu}
                viewStyle={[smallBtn, { alignItems: 'flex-end', marginRight: s(4) }]}
                ionicons
                name="md-ellipsis-vertical-circle"
                size={iconSize + s(3)}
              />
              <Space height={vs(12)} />
            </>
          )}
        </View>
        <View style={headerInfo}>
          {/* name, create date/email */}
          <Space height={vs(2)} />
          <View style={headerName}>
            <Text numberOfLines={1} h={'h6'} title={fullName} />
            <Text h={'h6'} textStyle={lightText} title={` · ${date}`} />
            <View style={flex1} />
            <TouchableOpacity onPress={handleTranslate}>
              <EmojiText name={flag} fontSize={s(18)} />
            </TouchableOpacity>
          </View>
          <Space height={vs(5)} />
          <HashtagFormat textStyle={textStyle} numberOfLines={8} h={'h5'} title={text} />
          {!item.accept && (
            <>
              <Space height={vs(5)} />
              <Text oneColor={orange} h={'h6'} title={I18n.t('review')} />
            </>
          )}
          {/* Preview Buttons */}
          <View style={btnsContainer}>
            <ButtonVectorIcon
              onPress={handleComment}
              count={commCount}
              viewStyle={[smallBtn, { justifyContent: 'flex-start' }]}
              ionicons
              name="chatbubble-outline"
              size={iconSize}
            />
            <ButtonVectorIcon
              count={likeCount}
              onPress={handleLike}
              color={heartColor}
              ionicons
              iconSize={iconSize + s(1.5)}
              viewStyle={smallBtn}
              name={heart}
              size={iconSize}
            />
            <ButtonVectorIcon
              viewStyle={[smallBtn, { justifyContent: 'flex-end', marginRight: s(5) }]}
              name="md-link-outline"
              ionicons
              iconSize={iconSize + s(4)}
              onPress={handleShareLink}
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
    alignItems: 'center',
    justifyContent: 'center'
  },
  textStyle: {
    lineHeight: s(21)
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
  },
  likeBtn: {
    flex: 2,
    justifyContent: 'center'
  },
  avaContainer: {
    height: '100%'
  }
})

const {
  container,
  img,
  btnsContainer,
  smallBtn,
  mediumBtn,
  textStyle,
  headerS,
  headerInfo,
  headerName,
  lightText,
  flex1,
  likeBtn,
  avaContainer
} = style
