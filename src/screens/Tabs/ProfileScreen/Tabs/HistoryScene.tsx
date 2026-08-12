import React, { useContext } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { s, vs } from 'react-native-size-matters'
import { HistoryT } from '../../../../types/types'

import { HistoryStep, SceneStates, Space } from '../../../../components'
import { useHistoryData, useTypedNavigation } from '../../../../hooks'
import { TabContext } from '../TabContext'

export const HistoryScene = observer(() => {
  const { t } = useTranslation()
  const { navigate } = useTypedNavigation()
  const { data, loading, error, refresh } = useHistoryData() as {
    data: HistoryT[]
    loading: boolean
    error: string | null
    refresh: () => void
  }

  const {
    panGesture1,
    scrollViewGesture1,
    scrollOffset1,
    blockScrollUntilAtTheTop1
  } = useContext(TabContext) as any

  const state = loading
    ? ({ type: 'loading' } as const)
    : error
    ? ({ type: 'error', message: error, onRetry: refresh } as const)
    : data.length === 0
    ? ({
        type: 'empty',
        title: t('profileEmpty.historyTitle'),
        message: t('profileEmpty.historyMessage'),
        icon: '🎲',
        action: {
          title: t('profileEmpty.historyAction'),
          onPress: () => navigate('SELECT_PLAYERS_SCREEN')
        }
      } as const)
    : ({ type: 'ready' } as const)

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop1, panGesture1),
        scrollViewGesture1
      )}
    >
      <SceneStates state={state} refreshing={loading} onRefresh={refresh}>
        <Animated.ScrollView
          bounces={false}
          scrollEventThrottle={1}
          onScrollBeginDrag={(e) => {
            scrollOffset1.value = e.nativeEvent.contentOffset.y
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} />
          }
        >
          <FlatList
            style={styles.historyList}
            scrollEnabled={false}
            ListFooterComponent={<Space height={vs(250)} />}
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            data={data}
            renderItem={(props) => <HistoryStep {...props} />}
            keyExtractor={(item) => String(item.createDate)}
            showsVerticalScrollIndicator={false}
          />
        </Animated.ScrollView>
      </SceneStates>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  historyList: {
    paddingHorizontal: s(10),
    flex: 1
  }
})
