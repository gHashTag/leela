import React from 'react'
import { observer } from 'mobx-react-lite'
import { RootStackParamList } from '../../types'
import { Background, ButtonsSelector, CenterView } from '../../components'
import { actionsDice } from '../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type navigation = NativeStackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const SelectPlayersScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const selectPlayer = async (selectItem: number) => {
    actionsDice.setPlayers(selectItem + 1)
    actionsDice.setOnline(false)
    actionsDice.init()
    navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
  }

  return (
    <Background>
      <CenterView>
        <ButtonsSelector onPress={selectPlayer} />
      </CenterView>
    </Background>
  )
})

export { SelectPlayersScreen }
