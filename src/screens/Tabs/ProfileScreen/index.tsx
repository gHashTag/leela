import React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react-lite'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { vs } from 'react-native-size-matters'
import {
  AppContainer,
  ButtonWithIcon,
  CenterView,
  HeaderMaster,
  OwnTabView,
  ProfileCompletionCard,
  SecondaryTab,
  Space,
  Spin
} from '../../../components'
import { OnlinePlayer } from '../../../store'
import { RootStackParamList, RootTabParamList } from '../../../types/types'

import { TabContextProvider } from './TabContext'
import {
  BookmarksScene,
  HistoryScene,
  IntentionOfGame,
  ReportsScene
} from './Tabs'
import { useActions } from '../../../components/HeaderMaster/useActions'

type ProfileScreenT = {
  navigation: NativeStackNavigationProp<
    RootTabParamList & RootStackParamList,
    'TAB_BOTTOM_3'
  >
}

const ProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const { width: W, height: H } = useWindowDimensions()
  const { t } = useTranslation()
  const { onPressEdit, ConfirmActionsDialog } = useActions()
  const tabViewWidth = W * 0.96

  const {
    avatar,
    plan,
    profile: { firstName, lastName }
  } = OnlinePlayer.store

  const handleCompleteStep = (step: string) => {
    switch (step) {
      case 'avatar':
      case 'name':
        navigation.navigate('USER_EDIT', OnlinePlayer.store.profile)
        break
      case 'intention':
        navigation.navigate('CHANGE_INTENTION_SCREEN', {
          prevIntention: OnlinePlayer.store.profile.intention
        })
        break
      case 'firstReport':
      default:
        navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
        break
    }
  }

  return (
    <AppContainer
      iconLeft={':information_source:'}
      title={t('profile')}
      textAlign="center"
      iconRight=':gear:'
      onPressRight={() => navigation.navigate('SETTINGS_SCENE')}
    >
      <TabContextProvider>
        {({ tabViewH, screenStyle, headerGesture }: any) => (
          <Animated.View style={screenStyle}>
            {OnlinePlayer.store.loadingProf ? (
              <CenterView>
                <Spin centered />
                <Space height={H * 0.5} />
              </CenterView>
            ) : (
              <View style={styles.container}>
                <HeaderMaster
                  avatar={avatar}
                  plan={plan}
                  firstName={firstName}
                  lastName={lastName}
                  editable
                  pro
                  onPressName={() =>
                    navigation.navigate('USER_EDIT', OnlinePlayer.store.profile)
                  }
                />
                <ProfileCompletionCard onCompleteStep={handleCompleteStep} />
                <Space height={vs(5)} />
                <ButtonWithIcon
                  title={t('settings.title')}
                  iconName="settings-outline"
                  onPress={() => navigation.navigate('SETTINGS_SCENE')}
                  viewStyle={styles.settingsButton}
                  accessibilityLabel={t('settings.title')}
                  accessibilityHint={t('settings.title')}
                  testID="profile-settings-button"
                />
                <Space height={vs(8)} />
                <OwnTabView
                  renderTabBar={(props) => (
                    <GestureDetector gesture={headerGesture}>
                      <SecondaryTab {...props} />
                    </GestureDetector>
                  )}
                  width={tabViewWidth}
                  screens={[
                    {
                      key: 'reports',
                      title: t('reports'),
                      Scene: ReportsScene
                    },
                    {
                      key: 'history',
                      title: t('history'),
                      Scene: HistoryScene
                    },
                    {
                      key: 'intentionOfGame',
                      title: t('intention'),
                      Scene: IntentionOfGame
                    },
                    {
                      key: 'bookmarks',
                      title: t('bookmarks.tab'),
                      Scene: BookmarksScene
                    }
                  ]}
                  style={[styles.tabContainer, { height: tabViewH }]}
                />
              </View>
            )}
          </Animated.View>
        )}
      </TabContextProvider>
      <ConfirmActionsDialog />
    </AppContainer>
  )
})

const styles = StyleSheet.create({
  tabContainer: {},
  container: {
    alignItems: 'center',
    width: '100%'
  },
  settingsButton: {
    alignSelf: 'center'
  }
})

export { ProfileScreen }
