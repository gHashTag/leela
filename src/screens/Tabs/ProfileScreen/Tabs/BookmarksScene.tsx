import React, { useCallback, useContext, useEffect, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import {
  BookmarkButton,
  EmptyComments,
  HashtagFormat,
  PlanAvatar,
  Space,
  Text
} from '../../../../components'
import { gray, lightGray } from '../../../../constants'
import { getTimeStamp } from '../../../../screens/helper'
import { BookmarkT, loadBookmarks } from '../../../../utils/bookmarks'
import { useTypedNavigation } from '../../../../hooks'
import { TabContext } from '../TabContext'

export const BookmarksScene = observer(() => {
  const { t } = useTranslation()
  const { navigate } = useTypedNavigation()
  const [bookmarks, setBookmarks] = useState<BookmarkT[]>([])

  const {
    panGesture0,
    scrollViewGesture0,
    blockScrollUntilAtTheTop0
  } = useContext(TabContext) as any

  const refresh = useCallback(() => {
    loadBookmarks().then(setBookmarks)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onPressItem = (bookmark: BookmarkT) => {
    navigate('DETAIL_POST_SCREEN', { postId: bookmark.postId })
  }

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop0, panGesture0),
        scrollViewGesture0
      )}
    >
      <FlatList
        removeClippedSubviews={false}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        data={bookmarks}
        keyExtractor={(a) => a.id}
        onEndReached={refresh}
        onEndReachedThreshold={0.1}
        ItemSeparatorComponent={() => <Space height={vs(10)} />}
        ListHeaderComponent={<Space height={vs(10)} />}
        ListFooterComponent={<Space height={vs(250)} />}
        ListEmptyComponent={<View style={styles.empty}>
            <EmptyComments />
            <Space height={vs(12)} />
            <Text
              h="h6"
              textStyle={styles.emptyText}
              title={t('bookmarks.empty')}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressItem(item)} style={styles.card}>
            <View style={styles.header}>
              <PlanAvatar plan={item.plan || 0} size="medium" />
              <Space width={s(8)} />
              <View style={styles.headerText}>
                <Text h="h6" numberOfLines={1} title={item.ownerName || ''} />
                <Text
                  h="h11"
                  colors={{ light: lightGray, dark: gray }}
                  title={getTimeStamp({ lastTime: item.savedAt })}
                />
              </View>
              <BookmarkButton bookmark={item} size={s(18)} />
            </View>
            <Space height={vs(8)} />
            <HashtagFormat
              h="h6"
              numberOfLines={6}
              title={item.text}
              selectable
            />
          </Pressable>
        )}
      />
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: s(12),
    paddingVertical: vs(8)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerText: {
    flex: 1
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: s(20)
  },
  emptyText: {
    textAlign: 'center'
  }
})
