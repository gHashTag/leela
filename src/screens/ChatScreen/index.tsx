import React from 'react'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../'
import { Background, Dice, GameBoard, Header, Space, Txt, ButtonElements } from '../../components'
import {
  DiceStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix,
  actionsDice
} from '../../store'
import { Button } from 'react-native'
import Rate from 'react-native-rate'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type ChatScreenT = {
  navigation: navigation
}

const ChatScreen = observer(({ navigation }: ChatScreenT) => {
  return (
    <Background>
      <Txt h3 title={DiceStore.message} />
    </Background>
  )
})

export { ChatScreen }
