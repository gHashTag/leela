import React, { useContext, useEffect, useState } from 'react'

import firestore from '@react-native-firebase/firestore'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react-lite'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { s, vs } from 'react-native-size-matters'
import {
  AppContainer,
  CenterView,
  HeaderMaster,
  HistoryStep,
  OwnTabView,
  SecondaryTab,
  Space,
  Spin,
  Text
} from 'src/components'
import { RootStackParamList, UserT } from 'src/types'

import { getIMG } from '../helper'
import {
  TabContext,
  TabContextProvider
} from '../Tabs/ProfileScreen/TabContext'

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'USER_PROFILE_SCREEN'
>

type UserProfileScreenT = {
  navigation: navigation
  route: RouteProp<RootStackParamList, 'USER_PROFILE_SCREEN'>
}

export const UserProfileScreen = observer(
  ({ navigation, route }: UserProfileScreenT) => {
    const { ownerId } = route.params
    const [data, setData] = useState({
      intention: '',
      history: [],
      avatar: '',
      plan: 0,
      fullName: ''
    })

    const [load, setLoad] = useState(true)
    const { t } = useTranslation()

    useEffect(() => {
      const unsub = firestore()
        .collection('Profiles')
        .doc(ownerId)
        .onSnapshot(async (snap) => {
          const { avatar, intention, history, plan, firstName, lastName } =
            snap.data() as UserT
          const avaUrl = await getIMG(avatar)
          setData({
            intention: intention || '',
            history: history as any,
            avatar: avaUrl,
            plan: plan,
            fullName: `${firstName} ${lastName}`
          })
          setLoad(false)
        })

      return unsub
    }, [ownerId])

    const { width: W, height: H } = useWindowDimensions()
    const tabViewWidth = W * 0.96

    return (
      <AppContainer
        enableBackgroundBottomInsets
        iconLeft={':back:'}
        onPress={navigation.goBack}
        title=" "
      >
        {load ? (
          <CenterView>
            <Spin centered />
            <Space height={H * 0.5} />
          </CenterView>
        ) : (
          <TabContextProvider hasBottomTabs={false}>
            {({ tabViewH, screenStyle, headerGesture }: any) => (
              <Animated.View style={screenStyle}>
                <View style={page.mainContainer}>
                  <HeaderMaster
                    avatar={data.avatar}
                    plan={data.plan}
                    fullName={data.fullName}
                  />
                  <Space height={vs(5)} />
                  <OwnTabView
                    renderTabBar={(props) => (
                      <GestureDetector gesture={headerGesture}>
                        <SecondaryTab {...props} />
                      </GestureDetector>
                    )}
                    width={tabViewWidth}
                    screens={[
                      {
                        key: 'history',
                        title: t('history'),
                        props: { history: data.history },
                        Scene: RenderHistoryTab
                      },
                      {
                        key: 'intentionOfGame',
                        title: t('intention'),
                        props: { intention: data.intention },
                        Scene: RenderIntentionOfGameTab
                      }
                    ]}
                    style={{ height: tabViewH }}
                  />
                </View>
              </Animated.View>
            )}
          </TabContextProvider>
        )}
      </AppContainer>
    )
  }
)

const RenderHistoryTab = ({ history }: any) => {
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
        style={page.flexOne}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={(e) => {
          scrollOffset1.value = e.nativeEvent.contentOffset.y
        }}
      >
        <Space height={vs(10)} />
        {history.map((item: any, index: number) => (
          <View key={String(index)} style={page.withPaddings}>
            <HistoryStep item={item} index={index} />
          </View>
        ))}
        <Space height={vs(10)} />
      </Animated.ScrollView>
    </GestureDetector>
  )
}

const RenderIntentionOfGameTab = ({ intention }: { intention: string }) => {
  const { headerGesture } = useContext(TabContext) as any
  return (
    <GestureDetector gesture={headerGesture}>
      <View style={[page.flexOne, page.withPaddings]}>
        {intention && (
          <>
            <Space height={vs(5)} />
            <Text h="h5" title={intention} />
          </>
        )}
      </View>
    </GestureDetector>
  )
}

const page = StyleSheet.create({
  withPaddings: {
    paddingHorizontal: s(20)
  },
  flexOne: {
    flex: 1
  },
  mainContainer: {
    alignItems: 'center',
    width: '100%'
  }
})
