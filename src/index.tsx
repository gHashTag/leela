import React, { useEffect } from 'react'
import { useColorScheme, StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { TransitionPresets } from '@react-navigation/stack'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
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
  PosterScreen,
  WelcomeScreen
} from './screens'

import {
  SignUp,
  SignUpUsername,
  SignIn,
  ConfirmSignUp,
  User,
  Forgot,
  ForgotPassSubmit,
  Hello,
  UserEdit,
  SignUpAvatar
} from './screens/Authenticator'

import TabNavigator from './TabNavigator'
import { white, black } from './constants'

import { UI } from './UI'

import { DiceStore, actionPlayers, OnlinePlayerStore } from './store'
import { DataStore, Hub } from 'aws-amplify'
import { Profile } from './models'
import { useFocusEffect } from '@react-navigation/native'

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

const Tab = () => {
  useFocusEffect(
    React.useCallback(() => {
    if (DiceStore.online) {
      const subscription = DataStore.observe(Profile).subscribe(
      () => {
        actionPlayers.getOtherProf()
      })
      OnlinePlayerStore.subs = subscription
      return () => {
        subscription.unsubscribe()
      }
    }
    }, [])
  )

  return (
    <TabNavigator.Navigator initialRouteName={'TAB_BOTTOM_0'}>
      <TabNavigator.Screen name="TAB_BOTTOM_0" component={PosterScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_1" component={GameScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_2" component={ProfileScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_3" component={OnlineGameScreen} />
    </TabNavigator.Navigator>
  )
}

const Stack = createNativeStackNavigator()

const horizontalAnimation = {
  cardStyleInterpolator: ({ current, layouts }) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width, 0]
            })
          }
        ]
      }
    }
  }
}

const App = () => {
  const scheme = useColorScheme()
  const theme = scheme === 'dark' ? DarkTheme : LightTheme
  const color = scheme === 'dark' ? 'light-content' : 'dark-content'
 
  useEffect(() => {
    Hub.listen('auth', (event) => {
      if (event.payload.event === 'signIn' || event.payload.event === 'signUp') {
        DiceStore.online = true
        actionPlayers.getProfile()
      } else if (event.payload.event === 'signOut') {
        DiceStore.online = false
      }
    })
  }, [])
 
  return (
    <NavigationContainer theme={theme}>
      <StatusBar backgroundColor={scheme === 'dark' ? black : white} barStyle={color} />
      <Stack.Navigator
        screenOptions={{
          ...TransitionPresets.ModalPresentationIOS,
          cardOverlayEnabled: true,
          gestureEnabled: true,
          headerShown: false,
          cardStyle: {
            backgroundColor: scheme === 'dark' ? black : white,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25
          }
        }}
        initialRouteName="WELCOME_SCREEN"
        mode="modal"
        headerMode="none"
      >
        <Stack.Screen name="UI" component={UI} options={horizontalAnimation} />
        <Stack.Screen name="WELCOME_SCREEN" component={WelcomeScreen} options={horizontalAnimation} />

        <Stack.Screen name="HELLO" component={Hello} options={horizontalAnimation} />
        <Stack.Screen name="SIGN_UP" component={SignUp} options={horizontalAnimation} />
        <Stack.Screen name="SIGN_UP_USERNAME" component={SignUpUsername} options={horizontalAnimation} />
        <Stack.Screen name="SIGN_UP_AVATAR" component={SignUpAvatar} options={horizontalAnimation} />
        <Stack.Screen name="SIGN_IN" component={SignIn} options={horizontalAnimation} />
        <Stack.Screen name="FORGOT" component={Forgot} options={horizontalAnimation} />
        <Stack.Screen name="FORGOT_PASSWORD_SUBMIT" component={ForgotPassSubmit} options={horizontalAnimation} />
        <Stack.Screen name="CONFIRM_SIGN_UP" component={ConfirmSignUp} options={horizontalAnimation} />
        <Stack.Screen name="USER" component={User} options={horizontalAnimation} />

        <Stack.Screen name="SELECT_PLAYERS_SCREEN" component={SelectPlayersScreen} options={horizontalAnimation} />
        <Stack.Screen name="MAIN" component={Tab} options={horizontalAnimation} />
        <Stack.Screen name="RULES_SCREEN" component={RulesScreen} />
        <Stack.Screen name="RULES_DETAIL_SCREEN" component={RulesDetailScreen} />
        <Stack.Screen name="PLANS_SCREEN" component={PlansScreen} />
        <Stack.Screen name="PLANS_DETAIL_SCREEN" component={PlansDetailScreen} />
        <Stack.Screen name="PLAYRA_SCREEN" component={PlayraScreen} options={horizontalAnimation} />
        <Stack.Screen name="USER_EDIT" component={UserEdit} options={horizontalAnimation} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Sentry.withProfiler(App)
