import React, { useContext } from 'react'

import { observer } from 'mobx-react'
import { FlatList, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { s, vs } from 'react-native-size-matters'
import { HistoryT } from '../../../../types/types'

import { HistoryStep, Space } from '../../../../components'
import { useHistoryData } from '../../../../hooks/useHistoryData'
import { TabContext } from '../TabContext'

export const HistoryScene = observer(() => {
  const data = useHistoryData() as HistoryT[]
  const {
    panGesture1,
    scrollViewGesture1,
    scrollOffset1,
    blockScrollUntilAtTheTop1
  } = useContext(TabContext) as any

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop1, panGesture1),
        scrollViewGesture1
      )}
    >
      <Animated.ScrollView
        bounces={false}
        scrollEventThrottle={1}
        onScrollBeginDrag={(e) => {
          scrollOffset1.value = e.nativeEvent.contentOffset.y
        }}
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
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  historyList: {
    paddingHorizontal: s(10),
    flex: 1
  }
})
