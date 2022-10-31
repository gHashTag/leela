import React, { useContext } from 'react'
import { SectionList, StyleSheet } from 'react-native'
import { observer } from 'mobx-react'
import { s, vs } from 'react-native-size-matters'

import { Text, Space, HistoryStep } from '../../../../components'
import { useHistoryData } from '../../../../hooks/useHistoryData'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { TabContext } from '../TabContext'
import Animated from 'react-native-reanimated'

export const HistoryScene = observer(() => {
  const { DATA } = useHistoryData()
  const { panGesture, scrollViewGesture, scrollOffset } = useContext(TabContext) as any
  return (
    <GestureDetector gesture={Gesture.Simultaneous(panGesture, scrollViewGesture)}>
      <Animated.ScrollView
        bounces={false}
        scrollEventThrottle={1}
        onScrollBeginDrag={e => {
          scrollOffset.value = e.nativeEvent.contentOffset.y
        }}
      >
        <SectionList
          style={historyList}
          scrollEnabled={false}
          ListFooterComponent={<Space height={vs(100)} />}
          initialNumToRender={60}
          maxToRenderPerBatch={60}
          stickySectionHeadersEnabled={false}
          sections={[...DATA, ...DATA, ...DATA, ...DATA]} //[...DATA, ...DATA, ...DATA, ...DATA]
          renderItem={props => <HistoryStep {...props} />}
          keyExtractor={(e, id) => String(id)}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section: { title } }) =>
            title ? (
              <Text h={'h3'} title={title} textStyle={{ padding: 15, marginTop: 10 }} />
            ) : (
              <Space height={20} />
            )
          }
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

const { historyList } = styles
