import React from 'react'
import { useColorScheme, StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
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
  ChatScreen
} from './screens'

import TabNavigator from './TabNavigator'
import { white, black } from './constants'
// import { UI } from './UI'

export type RootStackParamList = {
  MAIN: undefined
  PLAYRA_SCREEN: undefined
  TAB_BOTTOM_0: undefined
  RULES_SCREEN: undefined
  RULES_DETAIL_SCREEN: {
    id: number
    title: string
    content: string
    url: string
    videoUrl: string
  }
  PLANS_SCREEN: undefined
  SELECT_PLAYERS_SCREEN: undefined
  PLANS_DETAIL_SCREEN: {
    id: number
    title: string
    content: string
    url?: string
    videoUrl: string
  }
  PROFILE_SCREEN: undefined
  ONLINE_GAME_SCREEN: undefined
  RADIO_SCREEN: {
    id: number
    title: string
    content: string
    url: string
  }
}

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
  return (
    <TabNavigator.Navigator initialRouteName="TAB_BOTTOM_0">
      <TabNavigator.Screen name="TAB_BOTTOM_0" component={GameScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_1" component={ProfileScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_2" component={ChatScreen} />
      <TabNavigator.Screen name="TAB_BOTTOM_3" component={OnlineGameScreen} />
    </TabNavigator.Navigator>
  )
}

const Stack = createStackNavigator()

const App = () => {
  const scheme = useColorScheme()
  const theme = scheme === 'dark' ? DarkTheme : LightTheme
  const color = scheme === 'dark' ? 'light-content' : 'dark-content'

  return (
    <NavigationContainer theme={theme}>
      <StatusBar backgroundColor={scheme === 'dark' ? black : white} barStyle={color} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: scheme === 'dark' ? black : white }
        }}
        initialRouteName="SELECT_PLAYERS_SCREEN"
      >
        <Stack.Screen name="SELECT_PLAYERS_SCREEN" component={SelectPlayersScreen} />
        <Stack.Screen name="MAIN" component={Tab} />
        <Stack.Screen name="RULES_SCREEN" component={RulesScreen} />
        <Stack.Screen name="RULES_DETAIL_SCREEN" component={RulesDetailScreen} />
        <Stack.Screen name="PLANS_SCREEN" component={PlansScreen} />
        <Stack.Screen name="PLANS_DETAIL_SCREEN" component={PlansDetailScreen} />
        <Stack.Screen name="PLAYRA_SCREEN" component={PlayraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Sentry.withProfiler(App)
