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
  WelcomeScreen,
  PostScreen,
  DetailPostScreen
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
import { white, black, navRef } from './constants'

import { UI } from './UI'

import { DiceStore, fetchBusinesses, OnlinePlayer, OtherPlayers } from './store'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { getFireBaseRef } from './screens/helper'

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
  useEffect(() => {
    if (auth().currentUser?.uid) {
      const unsub1 = firestore()
        .collection('Profiles')
        .where('owner', '!=', auth().currentUser?.uid)
        .onSnapshot(s => OtherPlayers.getOtherProf({ snapshot: s }))
      const unsub2 = getFireBaseRef(`/online/`).on('child_changed', async changed => {
        await firestore()
          .collection('Profiles')
          .where('owner', '!=', auth().currentUser?.uid)
          .get()
          .then(queryS => {
            OtherPlayers.getOtherProf({ snapshot: queryS })
          })
      })
      return () => {
        unsub1()
        getFireBaseRef('/online/').off('child_changed', unsub2)
      }
    }
  }, [])
  //tabBar change tab pos, del amplify
  return (
    <TabNavigator.Navigator initialRouteName={'TAB_BOTTOM_0'}>
      <TabNavigator.Screen name="TAB_BOTTOM_0" component={PosterScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_1" component={ProfileScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_2" component={GameScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_3" component={PostScreen} />
      {/* <TabNavigator.Screen name="TAB_BOTTOM_4" component={OnlineGameScreen} /> */}
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
    const onAuthStateChanged = async (user: any) => {
      if (user) {
        OnlinePlayer.store.profile.email = user.email
        const reference = getFireBaseRef(`/online/${user.uid}`)
        reference.set(true)
        reference.onDisconnect().set(false)
        DiceStore.online = true
        OnlinePlayer.getProfile()
        fetchBusinesses()
        console.log(user)
      } else {
        DiceStore.online = false
        console.log('No user')
      }
    }
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged)
    return () => {
      subscriber()
    }
  }, [])

  return (
    <NavigationContainer ref={navRef} theme={theme}>
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
        initialRouteName="SELECT_PLAYERS_SCREEN"
        mode="modal"
        headerMode="none"
      >
        <Stack.Screen name="UI" component={UI} options={horizontalAnimation} />
        <Stack.Screen
          name="WELCOME_SCREEN"
          component={WelcomeScreen}
          options={horizontalAnimation}
        />

        <Stack.Screen name="HELLO" component={Hello} options={horizontalAnimation} />
        <Stack.Screen name="SIGN_UP" component={SignUp} options={horizontalAnimation} />
        <Stack.Screen
          name="SIGN_UP_USERNAME"
          component={SignUpUsername}
          options={horizontalAnimation}
        />
        <Stack.Screen
          name="SIGN_UP_AVATAR"
          component={SignUpAvatar}
          options={horizontalAnimation}
        />
        <Stack.Screen name="SIGN_IN" component={SignIn} options={horizontalAnimation} />
        <Stack.Screen name="FORGOT" component={Forgot} options={horizontalAnimation} />
        <Stack.Screen
          name="FORGOT_PASSWORD_SUBMIT"
          component={ForgotPassSubmit}
          options={horizontalAnimation}
        />
        <Stack.Screen
          name="CONFIRM_SIGN_UP"
          component={ConfirmSignUp}
          options={horizontalAnimation}
        />
        <Stack.Screen name="USER" component={User} options={horizontalAnimation} />

        <Stack.Screen
          name="SELECT_PLAYERS_SCREEN"
          component={SelectPlayersScreen}
          options={horizontalAnimation}
        />
        <Stack.Screen name="MAIN" component={Tab} options={horizontalAnimation} />
        <Stack.Screen name="RULES_SCREEN" component={RulesScreen} />
        <Stack.Screen name="RULES_DETAIL_SCREEN" component={RulesDetailScreen} />
        <Stack.Screen name="PLANS_SCREEN" component={PlansScreen} />
        <Stack.Screen name="PLANS_DETAIL_SCREEN" component={PlansDetailScreen} />
        <Stack.Screen
          name="PLAYRA_SCREEN"
          component={PlayraScreen}
          options={horizontalAnimation}
        />
        <Stack.Screen
          name="USER_EDIT"
          component={UserEdit}
          options={horizontalAnimation}
        />

        <Stack.Screen
          name="DETAIL_POST_SCREEN"
          component={DetailPostScreen}
          options={horizontalAnimation}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Sentry.withProfiler(App)
