import React, { ReactElement } from 'react'

import { ScaledSheet, ms, s, vs } from 'react-native-size-matters'

import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import {
  AppContainer,
  Button,
  CenterView,
  IconLeela,
  Space,
  Text
} from '../../../components'
import { white, black, goBack } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HELLO'>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const styles = ScaledSheet.create({
  img: {
    justifyContent: 'center',
    alignSelf: 'center',
    height: ms(150, 0.5),
    width: ms(150, 0.5)
  },
  h6: { alignSelf: 'center' }
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer onPress={goBack(navigation)} title=" " colorLeft={color}>
      <CenterView>
        <IconLeela />
        <Space height={s(30)} />
        <Button title={I18n.t('signIn')} onPress={() => navigation.navigate('SIGN_IN')} />
        <Space height={10} />
        <Text h={'h5'} title={I18n.t('or')} textStyle={styles.h6} />
        <Space height={10} />
        <Button title={I18n.t('signUp')} onPress={() => navigation.navigate('SIGN_UP')} />
        <Space height={vs(140)} />
      </CenterView>
    </AppContainer>
  )
}

export { Hello }
