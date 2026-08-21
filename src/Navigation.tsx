import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import * as Sentry from '@sentry/react'
import { observer } from 'mobx-react'
import React, { useEffect } from 'react'
import { StatusBar, useColorScheme } from 'react-native'
import Orientation from 'react-native-orientation-locker'
import SystemNavigationBar from 'react-native-system-navigation-bar'
import { RU_STORE } from '@env'
import { Fallback, OfflineBanner } from './components'
import {
  black,
  dimGray,
  lightGray,
  navRef,
  red,
  secondary,
  white
} from './constants'
import {
  useExitModal,
  useGameAndProfileIsOnline,
  useNetwork,
  useOfflinePostRetry,
  useWhatsNewModal
} from './hooks'
import { lang } from './i18n'
import {
  ActionsModal,
  ChangeIntention,
  ExitPopup,
  GameScreen,
  BoardScreen,
  InputTextModal,
  NetworkModal,
  OfflineProfileScreen, // OnlineGameScreen,
  OnboardingScreen,
  PlansDetailScreen,
  PlansScreen,
  PlayraScreen,
  PosterScreen,
  ProfileScreen,
  RulesDetailScreen,
  RulesScreen,
  SelectPlayersScreen,
  SettingsScene,
  SubscriptionScreen,
  UpdateVersionModal,
  UserProfileScreen,
  VideoPopup,
  WelcomeScreen,
  WhatsNewModal
} from './screens'
import {
  LazyChatScreen,
  LazyDetailPostScreen,
  LazyPlanReportModal,
  LazyPostScreen
} from './utils/lazyScreens'
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
import { checkVersion } from './screens/helper'
import { minVersion } from './minVersion.json'
import { DiceStore, SubscribeStore } from './store'
import { RootStackParamList, RootTabParamList } from './types/types'
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
  useOfflinePostRetry()
  useWhatsNewModal()
  const isBlockGame = SubscribeStore.isBlockGame
  return (
    <TabNavigator.Navigator
      // No tab bar.
      //
      // The board in three dimensions is the app: the game, the report gate,
      // the companion, the path and the question are all on that one screen,
      // so a row of tabs under it was a strip of chrome over the board and
      // nothing else.
      //
      // The screens below stay registered, so everything that navigates to a
      // named tab still arrives. `TabBar.tsx` is kept too, with its tests: a
      // bar that is one line from coming back is worth more than one that has
      // to be written again.
      tabBar={() => null}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: false
      }}
      initialRouteName={'TAB_BOTTOM_0'}
    >
      {/*
        The game, in three dimensions, on the tab the app opens on.

        The same page a browser runs at `BOARD_URL` — one board, one set of
        rules, one engine — embedded rather than ported, because a board drawn
        twice is two boards: they agree on the day they are written and drift
        from the first change after it. See `screens/Tabs/BoardScreen`.
      */}
      <TabNavigator.Screen
        name="TAB_BOTTOM_0"
        component={BoardScreen}
        options={{ title: 'tabRoute.board' }}
      />
      {DiceStore.online && (
        <TabNavigator.Screen
          name="TAB_BOTTOM_1"
          component={LazyPostScreen}
          options={{ title: 'tabRoute.feed' }}
        />
      )}
      <TabNavigator.Screen
        name="TAB_BOTTOM_2"
        component={DiceStore.online ? ProfileScreen : OfflineProfileScreen}
        options={{ title: 'tabRoute.profile' }}
      />
      {/*
        The flat board this app opened on until now, kept rather than deleted.

        It is the same game underneath — the report gate, the plans, the
        journal — drawn as a grid, and a player mid-game can still reach it
        while the 3D board becomes the way in.
      */}
      <TabNavigator.Screen
        name="TAB_BOTTOM_3"
        component={GameScreen}
        options={{ title: 'tabRoute.game' }}
      />
      {lang === 'ru' && (
        <TabNavigator.Screen
          name="TAB_BOTTOM_4"
          component={PosterScreen}
          options={{ title: 'tabRoute.poster' }}
        />
      )}
      {DiceStore.online && (
        <TabNavigator.Screen
          name="TAB_BOTTOM_5"
          component={
            RU_STORE
              ? LazyChatScreen
              : isBlockGame
                ? SubscriptionScreen
                : LazyChatScreen
          }
          options={{ title: 'tabRoute.chat' }}
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

  /*
   * The oldest version this build will run, read from the build itself.
   *
   * It used to be read from a Realtime Database node, and that read has been
   * failing: every launch logged
   * `[FirebaseDatabase] Listener at /minVersion failed: permission_denied`,
   * so `checkVersion` was never once called with a real value. A check that
   * cannot answer is not a check - it was a live subscription, kept open for
   * the life of the app, that only ever produced a warning.
   *
   * `src/minVersion.json` was already in the tree, and nothing read it. Now it
   * does, which is honest about what this is: a floor shipped with the app.
   *
   * What is lost is the ability to raise the floor on already-installed copies
   * without a release. That was the point of the remote node, and if it is
   * wanted again it needs a source that actually answers - the rules on that
   * database deny us.
   */
  useEffect(() => {
    checkVersion(minVersion)
  }, [])

  return (
    <NavigationContainer
      fallback={<Fallback />}
      // @ts-ignore
      linking={linking}
      ref={navRef}
      theme={theme}
    >
      <OfflineBanner />
      <StatusBar backgroundColor={isDark ? black : white} barStyle={color} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: false
        }}
        initialRouteName="ONBOARDING_SCREEN"
      >
        <Stack.Screen name="ONBOARDING_SCREEN" component={OnboardingScreen} />
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
        <Stack.Screen name="SETTINGS_SCENE" component={SettingsScene} />
        {/* Post */}
        <Stack.Screen
          options={{
            animation: 'slide_from_right'
          }}
          name="DETAIL_POST_SCREEN"
          component={LazyDetailPostScreen}
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
          <Stack.Screen name="WHATS_NEW_MODAL" component={WhatsNewModal} />
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
          <Stack.Screen
            name="PLAN_REPORT_MODAL"
            component={LazyPlanReportModal}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Sentry.withProfiler(App)
