import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import * as Sentry from '@sentry/react'
import { observer } from 'mobx-react'
import React, { useEffect } from 'react'
import { StatusBar, useColorScheme } from 'react-native'
import Orientation from 'react-native-orientation-locker'
import SystemNavigationBar from 'react-native-system-navigation-bar'
import TabBar from './TabBar'
import { Fallback } from './components'
import {
  black,
  dimGray,
  lightGray,
  navRef,
  red,
  secondary,
  white
} from './constants'
import { useExitModal, useGameAndProfileIsOnline, useNetwork } from './hooks'
import { lang } from './i18n'
import {
  ActionsModal,
  ChangeIntention,
  ChatScreen,
  DetailPostScreen,
  ExitPopup,
  GameScreen,
  InputTextModal,
  NetworkModal,
  OfflineProfileScreen, // OnlineGameScreen,
  PlanReportModal,
  PlansDetailScreen,
  PlansScreen,
  PlayraScreen,
  PostScreen,
  PosterScreen,
  ProfileScreen,
  RulesDetailScreen,
  RulesScreen,
  SelectPlayersScreen,
  SubscriptionScreen,
  UpdateVersionModal,
  UserProfileScreen,
  VideoPopup,
  WelcomeScreen
} from './screens'
import {
  ConfirmSignUp,
  Forgot,
  ForgotPassSubmit,
  Hello,
  SignIn,
  SignUp,
  SignUpAvatar,
  SignUpUsername,
  UserEdit
} from './screens/Authenticator'
import { checkVersion, getFireBaseRef } from './screens/helper'
import { DiceStore, SubscribeStore } from './store'
import { RootStackParamList, RootTabParamList } from './types'
import { linking } from './utils'

const DarkTheme = {
  dark: true,
  colors: {
    primary: secondary,
    background: black,
    card: white,
    text: white,
    border: dimGray,
    notification: red
  }
}

const LightTheme = {
  dark: false,
  colors: {
    primary: secondary,
    background: white,
    card: white,
    text: black,
    border: dimGray,
    notification: red
  }
}

const TabNavigator = createMaterialTopTabNavigator<RootTabParamList>()

const Tab = observer(() => {
  useGameAndProfileIsOnline()
  useExitModal()
  useNetwork()
  const isBlockGame = SubscribeStore.isBlockGame
  return (
    <TabNavigator.Navigator
      tabBar={(props) => <TabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: false
      }}
      initialRouteName={'TAB_BOTTOM_0'}
    >
      <TabNavigator.Screen name="TAB_BOTTOM_0" component={GameScreen} />
      {DiceStore.online && (
        <TabNavigator.Screen name="TAB_BOTTOM_1" component={PostScreen} />
      )}
      <TabNavigator.Screen
        name="TAB_BOTTOM_2"
        component={DiceStore.online ? ProfileScreen : OfflineProfileScreen}
      />
      {/* <TabNavigator.Screen name="TAB_BOTTOM_3" component={OnlineGameScreen} /> */}
      {lang === 'ru' && (
        <TabNavigator.Screen name="TAB_BOTTOM_4" component={PosterScreen} />
      )}
      {DiceStore.online && (
        <TabNavigator.Screen
          name="TAB_BOTTOM_5"
          component={isBlockGame ? SubscriptionScreen : ChatScreen}
        />
      )}
    </TabNavigator.Navigator>
  )
})

const Stack = createNativeStackNavigator<RootStackParamList>()

const App = () => {
  // Themes
  const isDark = useColorScheme() === 'dark'
  const theme = isDark ? DarkTheme : LightTheme
  const color = isDark ? 'light-content' : 'dark-content'

  useEffect(() => {
    SystemNavigationBar.setNavigationColor(
      isDark ? black : white,
      isDark ? 'dark' : 'light'
    )
    SystemNavigationBar.setNavigationBarDividerColor(lightGray)
    Orientation.lockToPortrait()
    // check version
  }, [isDark])

  useEffect(() => {
    const unsub = getFireBaseRef('/minVersion/').on('value', async (snap) => {
      checkVersion(snap.val())
    })
    return () => getFireBaseRef('/minVersion/').off('value', unsub)
  }, [])

  return (
    <NavigationContainer
      fallback={<Fallback />}
      // @ts-ignore
      linking={linking}
      ref={navRef}
      theme={theme}
    >
      <StatusBar backgroundColor={isDark ? black : white} barStyle={color} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: false
        }}
        initialRouteName="HELLO"
      >
        <Stack.Screen name="HELLO" component={Hello} />
        <Stack.Screen name="WELCOME_SCREEN" component={WelcomeScreen} />

        {/* Auth */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="SIGN_IN" component={SignIn} />
          <Stack.Screen name="FORGOT" component={Forgot} />
          <Stack.Screen
            name="FORGOT_PASSWORD_SUBMIT"
            component={ForgotPassSubmit}
          />
          <Stack.Screen name="SIGN_UP" component={SignUp} />
          <Stack.Screen name="SIGN_UP_USERNAME" component={SignUpUsername} />
          <Stack.Screen name="SIGN_UP_AVATAR" component={SignUpAvatar} />
          <Stack.Screen name="CONFIRM_SIGN_UP" component={ConfirmSignUp} />
        </Stack.Group>

        <Stack.Screen
          name="SELECT_PLAYERS_SCREEN"
          component={SelectPlayersScreen}
        />

        <Stack.Screen name="MAIN" component={Tab} />
        {/* Rules */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_left'
          }}
        >
          <Stack.Screen name="RULES_SCREEN" component={RulesScreen} />
          <Stack.Screen
            name="RULES_DETAIL_SCREEN"
            component={RulesDetailScreen}
          />
        </Stack.Group>

        {/* Plans */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen
            name="USER_PROFILE_SCREEN"
            component={UserProfileScreen}
          />
          <Stack.Screen name="PLANS_SCREEN" component={PlansScreen} />
          <Stack.Screen
            name="PLANS_DETAIL_SCREEN"
            component={PlansDetailScreen}
            options={{ gestureEnabled: false }}
          />
        </Stack.Group>

        <Stack.Screen name="PLAYRA_SCREEN" component={PlayraScreen} />
        <Stack.Screen name="USER_EDIT" component={UserEdit} />
        <Stack.Screen
          name="CHANGE_INTENTION_SCREEN"
          component={ChangeIntention}
        />
        {/* Post */}
        <Stack.Screen
          options={{
            animation: 'slide_from_right'
          }}
          name="DETAIL_POST_SCREEN"
          component={DetailPostScreen}
        />
        {/* Modals */}
        <Stack.Screen name="VIDEO_SCREEN" component={VideoPopup} />

        <Stack.Group
          screenOptions={{
            presentation: 'transparentModal',
            animation: 'fade',
            gestureEnabled: false
          }}
        >
          <Stack.Screen
            name="SUBSCRIPTION_SCREEN"
            component={SubscriptionScreen}
          />
          <Stack.Screen
            name="UPDATE_VERSION_MODAL"
            component={UpdateVersionModal}
          />
          <Stack.Screen
            name="REPLY_MODAL"
            options={{
              animation: 'slide_from_bottom'
            }}
            component={ActionsModal}
          />
          <Stack.Screen name="INPUT_TEXT_MODAL" component={InputTextModal} />
          <Stack.Screen name="EXIT_MODAL" component={ExitPopup} />
          <Stack.Screen name="NETWORK_MODAL" component={NetworkModal} />
          <Stack.Screen name="PLAN_REPORT_MODAL" component={PlanReportModal} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Sentry.withProfiler(App)
