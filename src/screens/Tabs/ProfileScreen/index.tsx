import React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react-lite'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { vs } from 'react-native-size-matters'

import { TabContextProvider } from './TabContext'
import { HistoryScene, IntentionOfGame, ReportsScene } from './Tabs'

import { AppContainer, CenterView, HeaderMaster, Space, Spin } from '../../../components'
import { OwnTabView } from '../../../components/OwnTabView'
import { SecondaryTab } from '../../../components/SecondaryTab'
import { DiceStore, OnlinePlayer } from '../../../store'
import { RootStackParamList, RootTabParamList } from '../../../types'
import { I18n } from '../../../utils'

type ProfileScreenT = {
  navigation: NativeStackNavigationProp<
    RootTabParamList & RootStackParamList,
    'TAB_BOTTOM_3'
  >
}

const ProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const { width: W, height: H } = useWindowDimensions()
  const tabViewWidth = W * 0.96

  return (
    <AppContainer
      iconRight={':books:'}
      iconLeft={':information_source:'}
      title={I18n.t('profile')}
      textAlign="center"
    >
      <TabContextProvider>
        {({ tabViewH, screenStyle, headerGesture }: any) => (
          <Animated.View style={screenStyle}>
            {OnlinePlayer.store.loadingProf && DiceStore.online ? (
              <CenterView>
                <Spin centered />
                <Space height={H * 0.5} />
              </CenterView>
            ) : (
              <View style={page.container}>
                {DiceStore.online && (
                  <HeaderMaster
                    onPress={() =>
                      navigation.navigate('USER_EDIT', OnlinePlayer.store.profile)
                    }
                  />
                )}
                <Space height={vs(5)} />
                <OwnTabView
                  renderTabBar={props => (
                    <GestureDetector gesture={headerGesture}>
                      <SecondaryTab {...props} />
                    </GestureDetector>
                  )}
                  width={tabViewWidth}
                  screens={[
                    { key: 'reports', title: I18n.t('reports'), Scene: ReportsScene },
                    { key: 'history', title: I18n.t('history'), Scene: HistoryScene },
                    {
                      key: 'intentionOfGame',
                      title: I18n.t('intention'),
                      Scene: IntentionOfGame,
                    },
                  ]}
                  style={[page.tabContainer, { height: tabViewH }]}
                />
              </View>
            )}
          </Animated.View>
        )}
      </TabContextProvider>
    </AppContainer>
  )
})

const page = StyleSheet.create({
  tabContainer: {},
  container: {
    alignItems: 'center',
    width: '100%',
  },
})

export { ProfileScreen }
