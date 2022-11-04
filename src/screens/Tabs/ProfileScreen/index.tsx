import React from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'

import { I18n } from '../../../utils'
import { RootTabParamList, RootStackParamList } from '../../../types'
import { AppContainer, Space, HeaderMaster, Spin, CenterView } from '../../../components'
import { DiceStore, OnlinePlayer } from '../../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SecondaryTab } from '../../../components/SecondaryTab'
import { GestureDetector } from 'react-native-gesture-handler'
import { HistoryScene, IntentionOfGame, ReportsScene } from './Tabs'
import Animated from 'react-native-reanimated'
import { TabContextProvider } from './TabContext'
import { OwnTabView } from '../../../components/OwnTabView'

type ProfileScreenT = {
  navigation: NativeStackNavigationProp<
    RootTabParamList & RootStackParamList,
    'TAB_BOTTOM_3'
  >
}
/* <Space height={70} />
          <Button
            title={I18n.t('startOver')}
            onPress={DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame}
          />
          <Space height={20} />
          {DiceStore.online && (
            <>
              <Button title={I18n.t('signOut')} onPress={OnlinePlayer.SignOut} />
              <Space height={20} />
            </>
          )} */

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
        {({ tabViewH, screenStyle, headerGesture, blockScrollUntilAtTheTop1 }: any) => (
          <Animated.View style={screenStyle}>
            {OnlinePlayer.store.loadingProf && DiceStore.online ? (
              <CenterView>
                <Spin centered />
                <Space height={H * 0.5} />
              </CenterView>
            ) : (
              <View style={{ alignItems: 'center', width: '100%' }}>
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
                      Scene: IntentionOfGame
                    }
                  ]}
                  style={[tabContainer, { height: tabViewH }]}
                />
              </View>
            )}
          </Animated.View>
        )}
      </TabContextProvider>
    </AppContainer>
  )
})

const styles = StyleSheet.create({
  tabContainer: {},
  tabScene: {}
})

const { tabContainer, tabScene } = styles

export { ProfileScreen }
