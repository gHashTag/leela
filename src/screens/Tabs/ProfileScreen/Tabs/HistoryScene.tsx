import React, { useContext } from 'react'

import { observer } from 'mobx-react'
import { SectionList, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { s, vs } from 'react-native-size-matters'

import { HistoryStep, Space, Text } from '../../../../components'
import { useHistoryData } from '../../../../hooks/useHistoryData'
import { TabContext } from '../TabContext'

export const HistoryScene = observer(() => {
  const { DATA } = useHistoryData()
  const { panGesture1, scrollViewGesture1, scrollOffset1, blockScrollUntilAtTheTop1 } =
    useContext(TabContext) as any
  return (
    <>
      <GestureDetector
        gesture={Gesture.Simultaneous(
          Gesture.Race(blockScrollUntilAtTheTop1, panGesture1),
          scrollViewGesture1,
        )}
      >
        <Animated.ScrollView
          bounces={false}
          scrollEventThrottle={1}
          onScrollBeginDrag={e => {
            scrollOffset1.value = e.nativeEvent.contentOffset.y
          }}
        >
          <SectionList
            style={page.historyList}
            scrollEnabled={false}
            ListFooterComponent={<Space height={vs(50)} />}
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            stickySectionHeadersEnabled={false}
            sections={DATA} //[...DATA, ...DATA, ...DATA, ...DATA]
            renderItem={props => <HistoryStep {...props} />}
            keyExtractor={(e, id) => String(id)}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <Text h={'h3'} title={title} textStyle={page.sectionHeaderText} />
              ) : (
                <Space height={vs(10)} />
              )
            }
          />
        </Animated.ScrollView>
      </GestureDetector>
      <Space height={vs(25)} />
    </>
  )
})

const page = StyleSheet.create({
  historyList: {
    paddingHorizontal: s(10),
    flex: 1,
  },
  sectionHeaderText: {
    padding: 15,
    marginTop: 10,
  },
})
