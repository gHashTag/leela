import React, { useEffect } from 'react'
import { useColorScheme, StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import TabBar from './TabBar'
import * as Sentry from '@sentry/react'
import {
  GameScreen,
  RulesScreen,
  RulesDetailScreen,
  PlansScreen,
  PlansDetailScreen,
  ProfileScreen,
  SelectPlayersScreen,
  OnlineGameScreen,
  PlayraScreen,
  WelcomeScreen,
  PostScreen,
  DetailPostScreen,
  ReplyModal,
  InputTextModal,
  ExitPopup,
  NetworkModal,
  VideoPopup,
  PlanReportModal,
  UpdateVersionModal
} from './screens'

import {
  SignUp,
  SignUpUsername,
  SignIn,
  ConfirmSignUp,
  Forgot,
  ForgotPassSubmit,
  Hello,
  UserEdit,
  SignUpAvatar
} from './screens/Authenticator'

import { white, black, navRef, lightGray } from './constants'

import { UI } from './UI'

import { checkVersion, getFireBaseRef } from './screens/helper'
import { linking } from './utils'
import SystemNavigationBar from 'react-native-system-navigation-bar'
import { Fallback } from './components'
import { RootStackParamList, RootTabParamList } from './types'
import Orientation from 'react-native-orientation-locker'
import { useGameAndProfileIsOnline, useNetwork, useExitModal } from './hooks'

const DarkTheme = {
  dark: true,
  colors: {
    primary: '#FF06F4',
    background: '#1c1c1c',
    card: 'rgb(255, 255, 255)',
    text: '#FFFF',
    border: 'rgb(199, 199, 204)',
    notification: 'rgb(255, 69, 58)'
  }
}

const LightTheme = {
  dark: false,
  colors: {
    primary: '#FF06F4',
    background: '#FFF',
    card: 'rgb(255, 255, 255)',
    text: '#1c1c1c',
    border: 'rgb(199, 199, 204)',
    notification: 'rgb(255, 69, 58)'
  }
}

const TabNavigator = createMaterialTopTabNavigator<RootTabParamList>()

const Tab = () => {
  useGameAndProfileIsOnline()
  useExitModal()
  useNetwork()

  return (
    <TabNavigator.Navigator
      tabBar={props => <TabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: false
      }}
      initialRouteName={'TAB_BOTTOM_0'}
    >
      <TabNavigator.Screen name="TAB_BOTTOM_0" component={GameScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_1" component={PostScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_2" component={ProfileScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_3" component={OnlineGameScreen} />
      {/* <TabNavigator.Screen name="TAB_BOTTOM_3" component={PosterScreen} /> */}
    </TabNavigator.Navigator>
  )
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const App = () => {
  // Themes
  const isDark = useColorScheme() === 'dark'
  const theme = isDark ? DarkTheme : LightTheme
  const color = isDark ? 'light-content' : 'dark-content'

  useEffect(() => {
    SystemNavigationBar.setNavigationColor(isDark ? black : white, isDark ? false : true)
    SystemNavigationBar.setNavigationBarDividerColor(lightGray)
    Orientation.lockToPortrait()
    // check version
    const unsub = getFireBaseRef(`/minVersion/`).on('value', async snap => {
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
          headerShown: false
        }}
        initialRouteName="WELCOME_SCREEN"
      >
        <Stack.Screen name="UI" component={UI} />
        {/* Auth */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="SIGN_IN" component={SignIn} />
          <Stack.Screen name="FORGOT" component={Forgot} />
          <Stack.Screen name="FORGOT_PASSWORD_SUBMIT" component={ForgotPassSubmit} />
          <Stack.Screen name="SIGN_UP" component={SignUp} />
          <Stack.Screen name="SIGN_UP_USERNAME" component={SignUpUsername} />
          <Stack.Screen name="SIGN_UP_AVATAR" component={SignUpAvatar} />
          <Stack.Screen name="CONFIRM_SIGN_UP" component={ConfirmSignUp} />
        </Stack.Group>

        <Stack.Screen name="WELCOME_SCREEN" component={WelcomeScreen} />
        <Stack.Screen name="HELLO" component={Hello} />
        <Stack.Screen name="SELECT_PLAYERS_SCREEN" component={SelectPlayersScreen} />

        <Stack.Screen name="MAIN" component={Tab} />
        {/* Rules */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_left'
          }}
        >
          <Stack.Screen name="RULES_SCREEN" component={RulesScreen} />
          <Stack.Screen name="RULES_DETAIL_SCREEN" component={RulesDetailScreen} />
        </Stack.Group>

        {/* Plans */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="PLANS_SCREEN" component={PlansScreen} />
          <Stack.Screen
            name="PLANS_DETAIL_SCREEN"
            component={PlansDetailScreen}
            options={{ gestureEnabled: false }}
          />
        </Stack.Group>

        <Stack.Screen name="PLAYRA_SCREEN" component={PlayraScreen} />
        <Stack.Screen name="USER_EDIT" component={UserEdit} />
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
          <Stack.Screen name="UPDATE_VERSION_MODAL" component={UpdateVersionModal} />
          <Stack.Screen
            name="REPLY_MODAL"
            options={{
              animation: 'slide_from_bottom'
            }}
            component={ReplyModal}
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
