import React from 'react'

import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import { RenderButtons } from '../../../components'
import { Space } from '../../../components'
import { lightGray } from '../../../constants'
import { RootStackParamList } from '../../../types'

interface ActionsModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'REPLY_MODAL'>
  route: RouteProp<RootStackParamList, 'REPLY_MODAL'>
}

export function ActionsModal({ navigation, route }: ActionsModalT) {
  const backgroundColor = useTheme().colors.background
  const schema = useColorScheme()
  const pressedColor = schema === 'dark' ? '#2B2B2B' : '#F5F5F5'
  return (
    <Pressable onPress={() => navigation.goBack()} style={transparentView}>
      <View style={[modal, { backgroundColor }]}>
        <Space height={vs(10)} />
        <FlatList
          data={route.params.buttons}
          keyExtractor={a => a.key}
          style={listContainer}
          renderItem={props => (
            <RenderButtons
              {...props}
              colorOnPress={pressedColor}
              press={() => navigation.goBack()}
            />
          )}
        />
        <Space height={vs(10)} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  modal: {
    width: '95%',
    backgroundColor: 'red',
    borderRadius: s(15),
    borderWidth: s(2),
    borderColor: lightGray,
  },
  transparentView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: vs(25),
  },
  listContainer: {
    paddingHorizontal: s(5),
  },
})

const { modal, transparentView, listContainer } = styles
