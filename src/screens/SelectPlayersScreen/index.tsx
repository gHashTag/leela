import React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'

import {
  Background,
  ButtonsSelector,
  CenterView,
  ResumeLastGame,
  Space,
  Text
} from '../../components'
import { s, vs } from 'react-native-size-matters'
import { actionsDice } from '../../store'
import { RootStackParamList } from '../../types/types'
import { triggerHaptic } from '../../utils/haptics'

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'SELECT_PLAYERS_SCREEN'
>

type SelectPlayersScreenT = {
  navigation: navigation
}

const SelectPlayersScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const { t } = useTranslation()

  const resumeGame = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
  }

  const selectPlayer = async (selectItem: number) => {
    triggerHaptic('impactLight')
    actionsDice.setPlayers(selectItem + 1)
    actionsDice.setOnline(false)
    actionsDice.init()
    navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
  }

  return (
    <Background enableBottomInsets enableTopInsets>
      <CenterView>
        <ResumeLastGame onResume={resumeGame} />
        <Space height={vs(24)} />
        <Text h="h3" title={t('selectPlayers')} testID="select-players-title" />
        <Space height={vs(8)} />
        <Text
          h="h6"
          title={t('selectPlayersSubtitle')}
          testID="select-players-subtitle"
        />
        <Space height={s(20)} />
        <ButtonsSelector onPress={selectPlayer} />
      </CenterView>
    </Background>
  )
})

export { SelectPlayersScreen }
